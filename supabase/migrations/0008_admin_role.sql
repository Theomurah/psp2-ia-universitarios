-- =============================================================================
-- Migration 0008 — Admin role + helper function
-- =============================================================================
-- Adiciona flag de admin em profiles para destravar:
--   - Painel /admin (config de prompts, modelos, métricas globais)
--   - Policies de RLS que permitam admin enxergar dados de todos os usuários
--
-- Modelo simples (boolean) em vez de tabela user_roles porque:
--   - Hoje só temos 1 papel privilegiado (admin)
--   - Volume baixo (1-2 admins por instância)
--   - Helper public.is_admin() abstrai o storage — se virar enum/tabela depois,
--     basta trocar o corpo da função sem mexer nas policies.
-- =============================================================================

-- A) Coluna -------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Flag de admin. Controla acesso ao painel /admin e a policies privilegiadas. Default false.';

-- Index parcial — só linhas com is_admin=true (raras) ficam indexadas.
create index if not exists idx_profiles_is_admin
  on public.profiles(id) where is_admin = true;

-- B) Helper function ----------------------------------------------------------
-- SECURITY DEFINER para conseguir ler profiles sem depender da policy do
-- caller (evita recursão de RLS quando policies usarem is_admin()).
-- search_path travado em '' conforme padrão do 0006_security_hardening.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select p.is_admin
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

comment on function public.is_admin() is
  'Retorna true se o usuário autenticado é admin. Use em policies de RLS para conceder acesso global. Stable + SECURITY DEFINER para evitar recursão.';

grant execute on function public.is_admin() to authenticated;

-- C) Promove o owner (Theo) ---------------------------------------------------
-- Lower-case para tolerar variação de capitalização no email.

update public.profiles
   set is_admin = true
 where lower(email) = lower('theo.murah@gmail.com');

-- D) Sanity check -------------------------------------------------------------
-- Se nenhum profile foi atualizado, levanta exception — significa que o
-- usuário ainda não fez login (auth.users vazio para esse email).

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.profiles
   where is_admin = true;

  if v_count = 0 then
    raise exception
      'Nenhum admin foi promovido. Faça login com theo.murah@gmail.com pelo menos uma vez para o trigger handle_new_user criar o profile, depois rode esta migration novamente.';
  end if;

  raise notice 'Admins ativos: %', v_count;
end $$;
