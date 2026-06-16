-- =============================================================================
-- Migration 0017 — Agregado de feedback para o painel /admin
-- =============================================================================
-- Origem: gap da auditoria de schema — tabela `feedback` (H10) era schema-first
-- (RLS + seed + export LGPD) mas não tinha nenhuma superfície de leitura agregada.
-- A coleta é feita direto pelo aluno via RLS (feedback_insert_own); aqui só
-- adicionamos a visão do admin, que precisa ler feedback de TODOS os usuários
-- (a RLS por user_id bloquearia), logo via RPC SECURITY DEFINER guardada por
-- is_admin() — mesmo padrão de admin_alerts() / admin_metrics_overview() (0015).
-- =============================================================================

create or replace function public.admin_feedback_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $fn$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select jsonb_build_object(
    'total', (select count(*) from public.feedback),
    -- avg sobre tabela vazia é NULL; normaliza pra 0 pra o front não tratar null
    'avg_rating', coalesce((select round(avg(rating)::numeric, 2) from public.feedback), 0),
    -- sempre devolve as 5 chaves (1..5), inclusive notas sem nenhuma ocorrência,
    -- pra as barras do painel não "sumirem" quando count = 0
    'by_rating', (
      select jsonb_object_agg(g.r::text, coalesce(c.cnt, 0))
      from generate_series(1, 5) g(r)
      left join (
        select rating, count(*) as cnt from public.feedback group by rating
      ) c on c.rating = g.r
    ),
    'by_topic', coalesce((
      select jsonb_agg(jsonb_build_object('topic', t.topic, 'count', t.cnt) order by t.cnt desc)
      from (
        select topic, count(*) as cnt from public.feedback group by topic
      ) t
    ), '[]'::jsonb),
    -- últimos 20 com contexto do documento avaliado (NULL = feedback geral).
    -- comments é texto do aluno destinado de propósito à equipe (não é log) —
    -- ver feedback.comments no schema; uso legítimo no /admin.
    'recent', coalesce((
      select jsonb_agg(e order by (e->>'created_at') desc)
      from (
        select jsonb_build_object(
          'id',             f.id,
          'rating',         f.rating,
          'topic',          f.topic,
          'comments',       f.comments,
          'created_at',     f.created_at,
          'document_title', coalesce(d.titulo, d.filename_final, d.filename_original)
        ) as e
        from public.feedback f
        left join public.jobs j      on j.id = f.job_id
        left join public.documents d on d.id = j.document_id
        order by f.created_at desc
        limit 20
      ) sub
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $fn$;

revoke all on function public.admin_feedback_overview() from public, anon;
grant execute on function public.admin_feedback_overview() to authenticated;

comment on function public.admin_feedback_overview() is
  'Agregado de feedback (total, média, distribuição por nota/tópico, últimos 20) para o painel /admin. SECURITY DEFINER guardado por is_admin(). Origem: gap de schema H10, 2026-05-29.';
