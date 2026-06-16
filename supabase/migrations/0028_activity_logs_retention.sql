-- =============================================================================
-- Migration 0028 — Retenção de activity_logs (limpeza > 90 dias via pg_cron)
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-07).
--
-- A 0018 criou activity_logs append-only e PROMETEU no comentário a limpeza
-- de registros > 90 dias "numa migration futura" — mas a pendência não estava
-- rastreada em lugar nenhum (roadmap pg_cron do CLAUDE.md só lista job_events).
-- Como cada page-load gera eventos, a tabela cresceria sem limite.
--
-- Em vez de só documentar a pendência, esta migration resolve: agenda o job
-- de limpeza diário via pg_cron (primeiro uso da extensão no projeto — sempre
-- via migration versionada, conforme CLAUDE.md).
--
-- Notas:
--   - pg_cron NÃO é relocatable (cria o schema `cron` próprio); por isso o
--     CREATE EXTENSION vai SEM `with schema extensions`, diferente do snippet
--     ilustrativo do roadmap no CLAUDE.md.
--   - Guard de ambiente: se pg_cron não estiver disponível (Postgres genérico
--     sem a extensão), emite WARNING e segue — a migration não pode travar a
--     cadeia por causa de um job de housekeeping.
--   - cron.schedule por nome é upsert (pg_cron >= 1.4): re-rodar atualiza o
--     job em vez de duplicar — idempotente.
--   - O comando roda como o role da migration (dono da tabela) — bypassa RLS,
--     que é o necessário pra apagar logs de todos os usuários.
-- =============================================================================

do $cron$
begin
  create extension if not exists pg_cron;

  perform cron.schedule(
    'cleanup-activity-logs',
    '0 3 * * *',  -- diário 03:00 UTC, junto da janela de housekeeping do roadmap
    $job$ delete from public.activity_logs where created_at < now() - interval '90 days'; $job$
  );

  raise notice 'pg_cron: job cleanup-activity-logs agendado (diário 03:00).';
exception when others then
  -- plpgsql resolve nomes em runtime: se o CREATE EXTENSION falhar, o
  -- cron.schedule nem chega a executar — qualquer falha cai aqui.
  raise warning
    'pg_cron indisponível/falhou neste ambiente — limpeza de activity_logs NÃO agendada (%). Agendar manualmente quando a extensão existir.',
    sqlerrm;
end $cron$;
