"""Exporta todas as tabelas do schema public como CSV em data/exports/.

Conecta via Postgres pooler usando a URL salva por `supabase link` em
supabase/.temp/pooler-url. Como roda como role `postgres`, ignora RLS
e pega tudo (real + test).

Colunas sensíveis de profiles (google_*_token) são omitidas via SELECT explícito.

Uso:
    python3 tools/export_supabase_csvs.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "exports"
OUT.mkdir(parents=True, exist_ok=True)

POOLER_URL_FILE = ROOT / "supabase" / ".temp" / "pooler-url"
if not POOLER_URL_FILE.exists():
    sys.exit(
        "ERRO: supabase/.temp/pooler-url não encontrado.\n"
        "Rode `supabase link --project-ref bthwkwgdbtrkixajvddi` primeiro."
    )
DB_URL = Path("/tmp/.psp2_dburl").read_text().strip() if Path("/tmp/.psp2_dburl").exists() else POOLER_URL_FILE.read_text().strip()

# (tabela, SELECT cols, ORDER BY)
TABLES = [
    (
        "profiles",
        "id, email, full_name, semestre_atual, materias, drive_root_folder_id, "
        "drive_connected_at, google_token_expires_at, is_admin, curso, is_test, "
        "created_at, updated_at",
        "created_at",
    ),
    ("documents",           "*", "created_at"),
    ("jobs",                "*", "created_at"),
    ("job_events",          "*", "created_at, id"),
    ("generated_content",   "*", "created_at"),
    ("prompt_library",      "*", "created_at"),
    ("user_system_prompts", "*", "created_at"),
    ("feedback",            "*", "created_at"),
    ("user_consents",       "*", "given_at"),
    ("app_settings",        "*", "key"),
]


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


def export(conn, name: str, select: str, order: str) -> int:
    sql = f"SELECT {select} FROM public.{name} ORDER BY {order}"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        rows = cur.fetchall()

    path = OUT / f"{name}.csv"
    if not rows:
        # cria CSV só com header inferindo do schema
        with conn.cursor() as c2:
            c2.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name=%s "
                "ORDER BY ordinal_position",
                (name,),
            )
            cols = [r[0] for r in c2.fetchall()]
        # remove tokens se for profiles
        if name == "profiles":
            cols = [c for c in cols if c not in ("google_refresh_token", "google_access_token")]
        with path.open("w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(cols)
        return 0

    fields = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in rows:
            w.writerow({k: normalize(r[k]) for k in fields})
    return len(rows)


def main() -> None:
    print(f"→ Conectando ao pooler...")
    try:
        conn = psycopg2.connect(DB_URL, connect_timeout=15)
    except psycopg2.OperationalError as e:
        sys.exit(f"ERRO de conexão: {e}")
    print(f"  ✓ conectado\n")
    print(f"→ Exportando para {OUT.relative_to(ROOT)}/\n")

    total = 0
    try:
        for name, select, order in TABLES:
            n = export(conn, name, select, order)
            sz = (OUT / f"{name}.csv").stat().st_size
            print(f"  ✓ {name:<22} {n:>5} linhas  {sz:>10,} bytes")
            total += n
    finally:
        conn.close()

    print(f"\n✓ Total: {total:,} linhas em {len(TABLES)} CSVs")


if __name__ == "__main__":
    main()
