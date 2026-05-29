-- =============================================================================
-- Migration 0013 — Flag de dados de teste em profiles
-- =============================================================================
-- Adiciona profiles.is_test pra marcar perfis criados por seed/teste.
-- Como TODAS as FKs em public.* tem ON DELETE CASCADE (exceto app_settings.updated_by
-- e feedback.job_id, ambos SET NULL — comportamento desejado), o cleanup completo
-- vira:
--
--   DELETE FROM public.profiles WHERE is_test = true;
--   DELETE FROM auth.users     WHERE email LIKE '%@psp2.test';
--
-- Em uma única operação, todos os documents/jobs/job_events/generated_content/
-- consents/system_prompts/prompt_library/feedback do user somem junto.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- Índice parcial: queries de "todos os dados reais" são as mais frequentes
-- e o índice ajuda no filtro WHERE is_test = false / WHERE is_test = true em joins.
CREATE INDEX profiles_is_test_idx
  ON public.profiles(is_test)
  WHERE is_test = true;

COMMENT ON COLUMN public.profiles.is_test IS
  'Marca perfis criados por seed/teste. DELETE FROM profiles WHERE is_test=true limpa tudo via cascade. Default false em perfis reais.';
