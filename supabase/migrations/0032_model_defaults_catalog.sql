-- =============================================================================
-- Migration 0032 — Defaults de modelo por estágio (catálogo OpenAI) + params
-- =============================================================================
-- Os defaults seedados na 0009 (deepseek, gemini-2.0-flash-exp, claude-sonnet-4.6)
-- só existem via OpenRouter — para quem usa a API da OpenAI direto (sem chave
-- OpenRouter), esses estágios falhavam por falta de chave.
--
-- Aqui fixamos uma config OpenAI coerente e custo-consciente, que funciona tanto
-- na API nativa (OPENAI_API_KEY) quanto via fallback OpenRouter:
--
--   classify          openai/gpt-4o-mini   (extração simples, barato, sem raciocínio)
--   synthesize        openai/gpt-5-mini    + reasoning_effort=medium  (qualidade)
--   compress_compact  openai/gpt-5-mini    + reasoning_effort=low
--   compress_cola     openai/gpt-5-mini    + reasoning_effort=low
--   judge             openai/gpt-4o-mini   (avaliação curta, barato)
--   vision            openai/gpt-4o-mini   (OCR multimodal, barato)
--
-- Os UPDATEs fixam os modelos no valor acima (config confirmada). Os params só
-- entram via INSERT … ON CONFLICT DO NOTHING — nunca sobrescrevem um ajuste de
-- effort já feito no painel /admin.
-- =============================================================================

-- ── Modelos por estágio ──────────────────────────────────────────────────────
update public.app_settings set value = '"openai/gpt-4o-mini"'::jsonb where key = 'model_classify';
update public.app_settings set value = '"openai/gpt-5-mini"'::jsonb  where key = 'model_synthesize';
update public.app_settings set value = '"openai/gpt-5-mini"'::jsonb  where key = 'model_compress_compact';
update public.app_settings set value = '"openai/gpt-5-mini"'::jsonb  where key = 'model_compress_cola';
update public.app_settings set value = '"openai/gpt-4o-mini"'::jsonb where key = 'model_judge';
update public.app_settings set value = '"openai/gpt-4o-mini"'::jsonb where key = 'model_vision';

-- ── Params avançados (gpt-5 reasoning_effort) — não clobbera ajuste do painel ──
insert into public.app_settings (key, value, description) values
  ('model_synthesize_params',       '{"reasoning_effort":"medium"}'::jsonb, 'Params da Síntese (gpt-5: reasoning_effort)'),
  ('model_compress_compact_params', '{"reasoning_effort":"low"}'::jsonb,    'Params da Cola compacta (gpt-5: reasoning_effort)'),
  ('model_compress_cola_params',    '{"reasoning_effort":"low"}'::jsonb,    'Params da Cola estendida (gpt-5: reasoning_effort)')
on conflict (key) do nothing;
