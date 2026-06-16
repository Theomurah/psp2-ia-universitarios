-- =============================================================================
-- Migration 0020 — Bloqueia escalada de privilégio via UPDATE em profiles
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-01, CRÍTICO).
--
-- A policy profiles_update_own (0006) permite UPDATE da própria linha sem
-- nenhuma restrição de COLUNA. Como is_admin (0008) e is_test (0013) vivem na
-- mesma tabela, qualquer usuário autenticado conseguia rodar
--
--   supabase.from('profiles').update({ is_admin: true }).eq('id', uid)
--
-- e virar admin — liberando todas as RPCs admin_* (emails, cursos e feedback
-- de todos os usuários) e a escrita em app_settings via admin_set_setting.
--
-- Correção: trigger BEFORE UPDATE que rejeita mudança das colunas privilegiadas
-- (is_admin, is_test, email) quando o invocador não é admin.
--   - auth.uid() IS NULL (service_role, migrations, triggers de sistema) passa:
--     Edge Functions, seeds e rotinas operacionais continuam funcionando.
--   - IS DISTINCT FROM na cláusula WHEN: UPDATE que não toca (ou reenvia o
--     valor atual de) uma coluna privilegiada NÃO dispara o trigger — o
--     onboarding (full_name/curso/semestre_atual/materias) segue intacto.
--   - SECURITY INVOKER de propósito: a função não acessa tabela nenhuma
--     (só OLD/NEW); public.is_admin() já é SECURITY DEFINER por conta própria.
-- =============================================================================

create or replace function public.tg_profiles_block_privileged_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Contexto sem JWT de usuário (service_role / migration / trigger interno):
  -- o chamador já é privilegiado por definição — não há o que escalar.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    raise exception 'forbidden: cannot change privileged profile columns'
      using errcode = '42501';
  end if;

  return new;
end $$;

comment on function public.tg_profiles_block_privileged_update() is
  'Guarda de BEFORE UPDATE em profiles: só admin (ou contexto sem JWT, ex: service_role) pode mudar is_admin/is_test/email. Fecha a escalada de privilégio da auditoria 2026-06-10 (MIGRATIONS-01).';

drop trigger if exists profiles_block_privileged_update on public.profiles;

-- WHEN: o trigger só dispara quando alguma coluna privilegiada de fato mudou.
create trigger profiles_block_privileged_update
  before update on public.profiles
  for each row
  when (
    old.is_admin is distinct from new.is_admin
    or old.is_test is distinct from new.is_test
    or old.email is distinct from new.email
  )
  execute function public.tg_profiles_block_privileged_update();
