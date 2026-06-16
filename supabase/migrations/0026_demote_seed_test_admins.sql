-- =============================================================================
-- Migration 0026 — Demove admins falsos criados pelo seed 0016
-- =============================================================================
-- Origem: auditoria 2026-06-10 (MIGRATIONS-02).
--
-- O seed 0016 (aplicado em prod) criou 2 profiles com is_admin=true
-- (i IN (10, 47), emails seed-NNN@psp2.test). Registro de admin que ninguém
-- controla é superfície de risco: se qualquer credencial dessas contas for
-- obtida, todas as RPCs admin_* abrem.
--
-- Esta migration só DEMOVE (is_admin=false) — não apaga os dados de teste,
-- porque a feature de filtro do /admin (0019, p_include_test) depende deles
-- pra demonstração. A limpeza completa continua documentada e fica a critério
-- do time:
--   DELETE FROM auth.users WHERE email LIKE '%@psp2.test';  -- cascateia tudo
--   DELETE FROM public.profiles WHERE is_test = true;       -- sobras, se houver
--
-- O trigger profiles_block_privileged_update (0020) permite este UPDATE:
-- migrations rodam sem JWT (auth.uid() IS NULL → passa).
-- Idempotente: re-rodar não encontra linhas pra atualizar.
-- =============================================================================

update public.profiles
   set is_admin = false
 where is_test = true
   and is_admin = true;

-- Sanity check: depois desta migration, nenhum perfil de teste pode ser admin.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.profiles
   where is_test = true
     and is_admin = true;

  if v_count > 0 then
    raise exception 'Ainda existem % perfis de teste com is_admin=true.', v_count;
  end if;

  raise notice 'OK: nenhum perfil de teste com is_admin=true.';
end $$;
