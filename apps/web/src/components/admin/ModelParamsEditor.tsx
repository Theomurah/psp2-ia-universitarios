/**
 * Editor de params avançados por modelo. Mostra só os campos que o modelo
 * selecionado aceita (effort/verbosity/thinking), via getModelCaps.
 *
 * Inspirado no ModelParamsEditor do Kawi. O objeto de params é persistido pelo
 * caller em app_settings (`model_<stage>_params`) e aplicado no backend conforme
 * o provider (ver _shared/openrouter.ts).
 */

import { useState } from 'react';
import { getModelCaps } from '../../config/modelCapabilities';

type Params = Record<string, unknown>;

interface Props {
  /** ID do modelo configurado (formato de roteamento, ex: 'openai/gpt-5-mini'). */
  modelId: string;
  /** Params atuais salvos pra este estágio. */
  currentParams: Params;
  /** Persiste os params (caller chama o RPC admin_set_setting). */
  onSave: (params: Params) => Promise<void>;
  saving: boolean;
}

const OPENAI_EFFORT = ['minimal', 'low', 'medium', 'high'] as const;
const GEMINI_EFFORT = ['low', 'medium', 'high'] as const;
const VERBOSITY = ['low', 'medium', 'high'] as const;
const ANTHROPIC_EFFORT = ['low', 'medium', 'high', 'max'] as const;

export function ModelParamsEditor({ modelId, currentParams, onSave, saving }: Props) {
  const caps = getModelCaps(modelId);
  const [draft, setDraft] = useState<Params>(currentParams);

  if (caps.family === null) {
    return (
      <p className="hint" style={{ fontStyle: 'italic', margin: 0 }}>
        Este modelo não tem parâmetros avançados configuráveis por aqui. (Disponível só para
        OpenAI, Anthropic e Gemini roteados nativamente — não via OpenRouter.)
      </p>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(currentParams);
  const thinking = (draft.thinking as { enabled?: boolean; effort?: string; budget_tokens?: number } | undefined) ?? {};

  // Helpers de update imutável
  const setReasoningEffort = (v: string) =>
    setDraft((d) => {
      const next = { ...d };
      if (v) next.reasoning_effort = v;
      else delete next.reasoning_effort;
      return next;
    });
  const setVerbosity = (v: string) =>
    setDraft((d) => {
      const next = { ...d };
      if (v) next.verbosity = v;
      else delete next.verbosity;
      return next;
    });

  return (
    <div className="model-params-editor">
      {/* ── OpenAI reasoning / Gemini ── */}
      {(caps.family === 'openai-reasoning' || caps.family === 'gemini-reasoning') && (
        <label className="field">
          <span>Reasoning effort — profundidade do raciocínio</span>
          <select
            value={(draft.reasoning_effort as string) ?? ''}
            onChange={(e) => setReasoningEffort(e.target.value)}
          >
            <option value="">(default do modelo)</option>
            {(caps.family === 'openai-reasoning' ? OPENAI_EFFORT : GEMINI_EFFORT).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      )}

      {caps.supportsVerbosity && (
        <label className="field">
          <span>Verbosity — quanto o modelo elabora a resposta</span>
          <select value={(draft.verbosity as string) ?? ''} onChange={(e) => setVerbosity(e.target.value)}>
            <option value="">(default do modelo)</option>
            {VERBOSITY.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      )}

      {/* ── Anthropic adaptive (effort) ── */}
      {caps.family === 'anthropic-adaptive' && (
        <>
          <label className="model-params-check">
            <input
              type="checkbox"
              checked={!!thinking.enabled}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  thinking: { ...thinking, enabled: e.target.checked, effort: thinking.effort ?? 'high' },
                }))
              }
            />
            <span>Adaptive thinking — modelo decide quanto raciocinar</span>
          </label>
          {thinking.enabled && (
            <label className="field">
              <span>Effort</span>
              <select
                value={thinking.effort ?? 'high'}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, thinking: { ...thinking, enabled: true, effort: e.target.value } }))
                }
              >
                {ANTHROPIC_EFFORT.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <small className="hint">low: simples · medium: balanceado · high: multi-step · max: sem limite (mais caro)</small>
            </label>
          )}
        </>
      )}

      {/* ── Anthropic extended (budget_tokens) ── */}
      {caps.family === 'anthropic-extended' && (
        <>
          <label className="model-params-check">
            <input
              type="checkbox"
              checked={!!thinking.enabled}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  thinking: {
                    ...thinking,
                    enabled: e.target.checked,
                    budget_tokens: thinking.budget_tokens ?? 4096,
                  },
                }))
              }
            />
            <span>Extended thinking — raciocina antes de responder</span>
          </label>
          {thinking.enabled && (
            <label className="field">
              <span>Budget de tokens de raciocínio</span>
              <input
                type="number"
                min={1024}
                max={32000}
                step={1024}
                value={typeof thinking.budget_tokens === 'number' ? thinking.budget_tokens : 4096}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    thinking: { ...thinking, enabled: true, budget_tokens: Number(e.target.value) },
                  }))
                }
              />
              <small className="hint">1024–32000 (a API exige temperature=1 quando ligado)</small>
            </label>
          )}
        </>
      )}

      <div className="model-params-actions">
        {!dirty && !saving && <span className="hint">Sem alterações pendentes</span>}
        <button type="button" className="primary" onClick={() => onSave(draft)} disabled={!dirty || saving}>
          {saving ? 'Salvando…' : 'Salvar params'}
        </button>
      </div>
    </div>
  );
}
