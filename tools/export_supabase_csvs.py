"""Exporta métricas das tabelas do schema public como CSV em data/exports/.

Finalidade (base do tratamento): análise quantitativa para o artigo ENEGEP —
volumetria, custos, latência e qualidade das sínteses. O export conecta como
role `postgres` (bypassa RLS), então aplica minimização de dados (LGPD):

- cada tabela tem allowlist EXPLÍCITA de colunas — coluna nova no schema NÃO
  entra no export sem edição consciente deste script;
- email sai reduzido ao domínio (`email_domain`); full_name, ip, user_agent,
  nomes de arquivo e paths de Drive/Storage não saem;
- conteúdo de aluno (generated_content.markdown, user_system_prompts.prompt_text,
  feedback.comments) só sai com a flag `--include-content` (pede confirmação);
  por default saem apenas contagens de caracteres (`*_chars`);
- profiles.is_test é exportado para permitir separar dados reais de teste
  na análise;
- app_settings sai filtrado por allowlist de keys (só nomes de modelos LLM).

Conexão (em ordem de precedência — nunca grava credencial em arquivo):
1. env var PSP2_DB_URL com a connection string completa:
   export PSP2_DB_URL='postgresql://postgres.<ref>:<senha>@<host>:5432/postgres'
2. supabase/.temp/pooler-url (criado por `supabase link`; não contém senha) +
   senha do role postgres pedida interativamente via getpass.

Saída: data/exports/*.csv criados com permissão 0600 (diretório 0700).
Retenção: os CSVs contêm dados pessoais pseudonimizados — apague após concluir
a análise do artigo (o diretório data/ é gitignored, mas backups locais como
Time Machine/iCloud ainda os copiam).

Uso:
    python3 tools/export_supabase_csvs.py [--include-content]
"""
from __future__ import annotations

import argparse
import csv
import getpass
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "exports"

POOLER_URL_FILE = ROOT / "supabase" / ".temp" / "pooler-url"
PROJECT_REF_FILE = ROOT / "supabase" / ".temp" / "project-ref"

# Keys de app_settings liberadas para export (allowlist — key nova exige
# edição consciente aqui; configs sensíveis futuras não vazam por default).
APP_SETTINGS_ALLOWED_KEYS = (
    "model_classify",
    "model_synthesize",
    "model_compress_compact",
    "model_compress_cola",
    "model_judge",
    "model_vision",
)

# (tabela, allowlist de colunas, colunas extras com --include-content,
#  ORDER BY, WHERE opcional)
#
# Allowlist por design: SELECT * é proibido aqui — coluna nova só entra no
# export se for adicionada explicitamente (default "não vaza").
TABLES = [
    (
        "profiles",
        # email pseudonimizado (só domínio); full_name e tokens ficam de fora.
        "id, split_part(email, '@', 2) as email_domain, semestre_atual, "
        "materias, curso, is_admin, is_test, drive_connected_at, "
        "created_at, updated_at",
        None,
        "created_at",
        None,
    ),
    (
        "documents",
        # sem filename_original/filename_final/storage_path/drive_* /titulo/
        # identificador (PII e conteúdo por convenção do projeto).
        "id, user_id, format, size_bytes, materia_code, tipo, data_doc, "
        "classificacao_confianca, created_at, processed_at, archived_at",
        None,
        "created_at",
        None,
    ),
    (
        "jobs",
        "id, user_id, document_id, status, current_step, progress_percent, "
        "attempt_count, error_reason, chars_input, chars_synthesis, "
        "chars_compression, cost_usd_total, started_at, completed_at, created_at",
        None,
        "created_at",
        None,
    ),
    (
        "job_events",
        # sem message (texto livre do pipeline; pode embutir payload de erro).
        "id, job_id, step, event_type, duration_ms, llm_model, tokens_input, "
        "tokens_output, cost_usd, created_at",
        None,
        "created_at, id",
        None,
    ),
    (
        "generated_content",
        # markdown é conteúdo de aluno — por default só a contagem de chars.
        "id, document_id, type, char_length(markdown) as markdown_chars, "
        "metadata, validation_score, created_at",
        "markdown",
        "created_at",
        None,
    ),
    (
        "prompt_library",
        # sem title/description/template (texto livre do aluno nos custom).
        "id, user_id, category, is_official, usage_count, created_at",
        None,
        "created_at",
        None,
    ),
    (
        "user_system_prompts",
        # prompt_text é o output principal do aluno — só com --include-content.
        "id, user_id, char_length(prompt_text) as prompt_chars, "
        "semester_snapshot, source_documents, version, is_active, created_at",
        "prompt_text",
        "created_at",
        None,
    ),
    (
        "feedback",
        # comments é texto livre do aluno — só com --include-content.
        "id, user_id, job_id, rating, topic, created_at",
        "comments",
        "created_at",
        None,
    ),
    (
        "user_consents",
        # sem ip e user_agent (PII além do necessário para métricas).
        "id, user_id, consent_type, version, accepted, given_at, revoked_at",
        None,
        "given_at",
        None,
    ),
    (
        "app_settings",
        # sem updated_by (FK para profiles); value só das keys da allowlist.
        "key, value, description, updated_at",
        None,
        "key",
        "key in ({})".format(", ".join(f"'{k}'" for k in APP_SETTINGS_ALLOWED_KEYS)),
    ),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporta métricas (minimizadas) do Supabase como CSV.",
    )
    parser.add_argument(
        "--include-content",
        action="store_true",
        help=(
            "inclui colunas de conteúdo de aluno (markdown, prompt_text, "
            "comments); exige confirmação interativa"
        ),
    )
    return parser.parse_args()


def resolve_db_url() -> str:
    """Resolve a connection string sem nunca persistir credencial em arquivo."""
    env_url = os.environ.get("PSP2_DB_URL", "").strip()
    if env_url:
        return env_url

    if not POOLER_URL_FILE.exists():
        ref = (
            PROJECT_REF_FILE.read_text().strip()
            if PROJECT_REF_FILE.exists()
            else "<project-ref>"
        )
        sys.exit(
            "ERRO: defina a env var PSP2_DB_URL com a connection string, ou rode\n"
            f"`supabase link --project-ref {ref}` para gerar supabase/.temp/pooler-url."
        )

    pooler_url = POOLER_URL_FILE.read_text().strip()
    parts = urlsplit(pooler_url)
    if parts.password:
        return pooler_url

    # pooler-url não contém senha — pede interativamente (não ecoa, não salva).
    password = getpass.getpass("Senha do role postgres (não fica salva): ")
    if not password:
        sys.exit("ERRO: senha vazia.")
    host = parts.hostname or ""
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{parts.username}:{quote(password, safe='')}@{host}{port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def open_private(path: Path):
    """Abre o CSV para escrita já com permissão 0600 (sem janela world-readable)."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    # cobre arquivo pré-existente de export antigo (O_CREAT não re-aplica mode)
    os.chmod(path, 0o600)
    return os.fdopen(fd, "w", newline="", encoding="utf-8")


def normalize(v):
    """Converte tipo Python → string CSV-friendly."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (dict, list)):
        # jsonb / arrays
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"), default=str)
    return v


def export(conn, name: str, select: str, order: str, where: str | None) -> int:
    sql = f"SELECT {select} FROM public.{name}"
    if where:
        sql += f" WHERE {where}"
    sql += f" ORDER BY {order}"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        # header vem da própria query (allowlist + aliases), mesmo com 0 linhas
        fields = [d.name for d in cur.description]
        rows = cur.fetchall()

    path = OUT / f"{name}.csv"
    with open_private(path) as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in rows:
            w.writerow({k: normalize(r[k]) for k in fields})
    return len(rows)


def main() -> None:
    args = parse_args()
    if args.include_content:
        print(
            "AVISO: --include-content exporta conteúdo de aluno em claro\n"
            "(generated_content.markdown, user_system_prompts.prompt_text,\n"
            "feedback.comments). Use apenas se a análise exigir o texto."
        )
        answer = input("Digite 'sim' para confirmar: ").strip().lower()
        if answer != "sim":
            sys.exit("Abortado: confirmação negada.")

    db_url = resolve_db_url()

    OUT.mkdir(parents=True, exist_ok=True)
    os.chmod(OUT, 0o700)

    print("→ Conectando ao pooler...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=15)
    except psycopg2.OperationalError as e:
        sys.exit(f"ERRO de conexão: {e}")
    print("  ✓ conectado\n")
    print(f"→ Exportando para {OUT.relative_to(ROOT)}/\n")

    total = 0
    try:
        for name, select, content_cols, order, where in TABLES:
            if args.include_content and content_cols:
                select = f"{select}, {content_cols}"
            n = export(conn, name, select, order, where)
            sz = (OUT / f"{name}.csv").stat().st_size
            print(f"  ✓ {name:<22} {n:>5} linhas  {sz:>10,} bytes")
            total += n
    finally:
        conn.close()

    print(f"\n✓ Total: {total:,} linhas em {len(TABLES)} CSVs")
    print(
        "\nAVISO LGPD: os CSVs contêm dados pessoais pseudonimizados"
        + (" E conteúdo de aluno em claro" if args.include_content else "")
        + ".\nUse apenas para a análise do artigo e APAGUE após o uso "
        "(rm -rf data/exports)."
    )


if __name__ == "__main__":
    main()
