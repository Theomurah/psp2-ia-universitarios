/**
 * Painel /admin/modelos — escolhe o modelo LLM usado em cada estágio do pipeline.
 *
 * Inspirado no seletor do Kawi: dropdown agrupado por provider, com os grupos
 * "destravados" pela presença da chave (useActiveProviders). Cada escolha vira
 * um app_settings via RPC admin_set_setting; as Edge Functions leem em até 60s.
 */

import { useMemo, useState } from 'react';
import { useAppSettings, useSetAppSetting } from '../../hooks/useAppSettings';
import { useActiveProviders } from '../../hooks/useActiveProviders';
import { useToast } from '../../components/Toast';
import {
  MODEL_CATALOG,
  PROVIDERS_META,
  getCatalogModel,
  providerOf,
  type CatalogModel,
  type ProviderId,
} from '../../config/models';
import { getModelCaps } from '../../config/modelCapabilities';
import { ModelParamsEditor } from '../../components/admin/ModelParamsEditor';

const STAGE_LABEL: Record<string, string> = {
  model_classify:         'Classificação',
  model_synthesize:       'Síntese',
  model_compress_compact: 'Cola (compacta)',
  model_compress_cola:    'Cola (estendida)',
  model_judge:            'Judge / validação',
  model_vision:           'Visão (OCR)',
};

// Descrição didática do que cada requisição ao LLM faz no pipeline — inclui
// quando roda e uma dica de custo, pra orientar a escolha do modelo.
const STAGE_DESCRIPTION: Record<string, string> = {
  model_classify:
    'Lê o início do documento e detecta matéria, tipo (prova, lista, resumo…) e data. Roda 1× por upload com pouco texto — um modelo barato e rápido dá conta.',
  model_synthesize:
    'Gera o resumo principal a partir do conteúdo completo. É a etapa mais pesada e a que mais define a qualidade final — vale um modelo mais capaz.',
  model_compress_compact:
    'Condensa a síntese numa cola curta (modo compacta), priorizando só o essencial para revisão rápida na véspera da prova.',
  model_compress_cola:
    'Condensa a síntese numa cola mais completa (modo cola), preservando fórmulas, definições e exemplos.',
  model_judge:
    'Avalia automaticamente a síntese gerada (atribui nota + comentário). Trabalha com texto curto — um modelo barato resolve.',
  model_vision:
    'Extrai texto de imagens e PDFs escaneados (foto do quadro, slide em imagem). Só é acionado quando o arquivo não tem texto selecionável.',
};

const CUSTOM_VALUE = '__custom__';

interface RowProps {
  settingKey: string;
  current: string;
  description: string | null;
  updatedAt: string;
  /** Params avançados salvos pra este estágio (effort/verbosity/thinking). */
  currentParams: Record<string, unknown>;
  /** Disponibilidade por provider (null = desconhecido, ex: endpoint não deployado) */
  providers: Record<ProviderId, boolean> | null;
}

function ModelRow({ settingKey, current, description, updatedAt, currentParams, providers }: RowProps) {
  const isVisionStage = settingKey === 'model_vision';
  const setSetting = useSetAppSetting();
  const toast = useToast();
  const stageLabel = STAGE_LABEL[settingKey] ?? settingKey;

  // Catálogo aplicável a este estágio (visão só aceita modelos com vision).
  const catalog = useMemo(
    () => (isVisionStage ? MODEL_CATALOG.filter((m) => m.vision) : MODEL_CATALOG),
    [isVisionStage],
  );
  const groups = useMemo(() => {
    const out: Record<ProviderId, CatalogModel[]> = { openai: [], anthropic: [], google: [], openrouter: [] };
    for (const m of catalog) out[m.provider].push(m);
    return out;
  }, [catalog]);

  const [value, setValue] = useState(current);
  // Modo custom: campo de texto livre (qualquer ID OpenRouter/provider).
  const [custom, setCustom] = useState(false);
  // Painel de params avançados (effort/verbosity/thinking) expandido.
  const [expanded, setExpanded] = useState(false);
  const [paramsSaving, setParamsSaving] = useState(false);
  // O <select> é controlado pelo `value` local — quando o valor selecionado não
  // está no catálogo (legado/custom), renderizamos uma opção "(atual)" pra que o
  // value controlado sempre case com uma <option> (senão a seleção "trava").
  const valueInCatalog = !!getCatalogModel(value);

  // Params avançados são baseados no modelo SALVO (o que de fato roda). Só há
  // toggle quando o modelo configurado expõe algum param (ver getModelCaps).
  const hasAdvanced = getModelCaps(current).family !== null;

  const dirty = value !== current;
  const selectedProvider = providerOf(value);
  const providerAvailable = providers === null ? null : providers[selectedProvider] === true;

  const handleSelect = (v: string) => {
    if (v === CUSTOM_VALUE) {
      setCustom(true);
      return;
    }
    setCustom(false);
    setValue(v);
  };

  const handleSave = async () => {
    const clean = value.trim();
    if (!clean) {
      toast.error('Modelo inválido', 'Informe um ID de modelo.');
      return;
    }
    try {
      await setSetting.mutateAsync({ key: settingKey, value: clean });
      toast.success('Modelo atualizado', `${stageLabel} agora usa ${clean}.`);
    } catch (err) {
      toast.error('Não foi possível salvar', (err as Error).message);
    }
  };

  const handleSaveParams = async (params: Record<string, unknown>) => {
    setParamsSaving(true);
    try {
      await setSetting.mutateAsync({ key: `${settingKey}_params`, value: params });
      toast.success('Params atualizados', `${stageLabel}.`);
    } catch (err) {
      toast.error('Não foi possível salvar', (err as Error).message);
    } finally {
      setParamsSaving(false);
    }
  };

  return (
    <div className="admin-model-row-wrap">
    <div className="admin-model-row">
      <div>
        <strong>{stageLabel}</strong>
        <p className="admin-model-desc">{STAGE_DESCRIPTION[settingKey] ?? description}</p>
        <small className="hint admin-model-meta">
          <code>{settingKey}</code> · atualizado {new Date(updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </small>
      </div>

      <div className="admin-model-select">
        {custom ? (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="provider/modelo (ex: openrouter/deepseek/deepseek-chat-v3)"
            spellCheck={false}
            autoFocus
            aria-label={`Modelo personalizado para ${stageLabel}`}
          />
        ) : (
          <select
            value={value}
            onChange={(e) => handleSelect(e.target.value)}
            aria-label={`Modelo para ${stageLabel}`}
          >
            {/* Valor selecionado fora do catálogo (legado/custom) — sempre visível */}
            {!valueInCatalog && value && (
              <option value={value}>{value} (atual)</option>
            )}
            {PROVIDERS_META.map((meta) => {
              const models = groups[meta.id];
              if (models.length === 0) return null;
              const known = providers !== null;
              const available = known ? providers[meta.id] === true : true;
              const label = known && !available ? `${meta.label} — sem chave` : meta.label;
              return (
                <optgroup key={meta.id} label={label}>
                  {models.map((m) => (
                    <option key={m.id} value={m.id} disabled={known && !available}>
                      {m.name}
                      {m.note ? ` — ${m.note}` : ''}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            <option value={CUSTOM_VALUE}>Personalizado…</option>
          </select>
        )}

        {/* Status do provider do modelo selecionado */}
        <div className="admin-model-status">
          {custom ? (
            <button type="button" className="link" onClick={() => { setCustom(false); setValue(current); }}>
              ← voltar pra lista
            </button>
          ) : providerAvailable === false ? (
            <span className="badge tone-warn">
              {selectedProvider === 'openrouter'
                ? 'OpenRouter sem chave'
                : 'sem chave deste provider'}
            </span>
          ) : providerAvailable === true ? (
            <span className="badge tone-success">chave configurada</span>
          ) : null}
        </div>
      </div>

      <div className="admin-model-row-actions">
        {hasAdvanced && (
          <button
            type="button"
            className="ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            title="Parâmetros avançados (effort, thinking, verbosity)"
          >
            Avançado {expanded ? '▲' : '▾'}
          </button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => { setValue(current); setCustom(false); }}
          disabled={!dirty || setSetting.isPending}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="primary"
          onClick={handleSave}
          disabled={!dirty || setSetting.isPending}
        >
          {setSetting.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>

    {expanded && hasAdvanced && (
      <div className="admin-model-advanced">
        <ModelParamsEditor
          modelId={current}
          currentParams={currentParams}
          onSave={handleSaveParams}
          saving={paramsSaving}
        />
      </div>
    )}
    </div>
  );
}

export default function AdminModelos() {
  const { data: settings, isLoading, error } = useAppSettings('model_');
  const { data: providersData } = useActiveProviders();
  const providers = providersData?.providers ?? null;

  if (isLoading) {
    return (
      <div className="full-page-loader" style={{ minHeight: '30vh' }}>
        <span className="spinner" />
        <span>Carregando configurações…</span>
      </div>
    );
  }

  if (error) {
    return <div className="empty">{(error as Error).message}</div>;
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Modelos de IA</h1>
          <p className="hint">
            Escolha o modelo usado em cada estágio do pipeline. O provider é definido pelo prefixo do modelo e
            destravado pela respectiva chave nos secrets do Supabase. As Edge Functions leem a mudança em até 60s.
          </p>
        </div>
      </header>

      {/* Chips de status por provider (espelha o Kawi) */}
      <section className="provider-chips" aria-label="Status dos providers">
        {PROVIDERS_META.map((meta) => {
          const known = providers !== null;
          const ok = known ? providers[meta.id] === true : null;
          const tone = ok === null ? 'tone-info' : ok ? 'tone-success' : 'tone-warn';
          const status = ok === null ? 'desconhecido' : ok ? 'configurado' : 'sem chave';
          return (
            <span key={meta.id} className={`badge ${tone}`} title={`Secret: ${meta.keyEnv}`}>
              {meta.label}: {status}
            </span>
          );
        })}
      </section>

      <section style={{ marginTop: '1rem' }}>
        {(settings ?? [])
          // Só as 6 chaves de estágio — as `*_params` são lidas à parte, não viram linha.
          .filter((s) => STAGE_LABEL[s.key])
          .map((s) => {
            const paramsRow = settings?.find((p) => p.key === `${s.key}_params`);
            const currentParams =
              paramsRow?.value && typeof paramsRow.value === 'object'
                ? (paramsRow.value as Record<string, unknown>)
                : {};
            return (
              <ModelRow
                key={s.key}
                settingKey={s.key}
                current={typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
                description={s.description}
                updatedAt={s.updated_at}
                currentParams={currentParams}
                providers={providers}
              />
            );
          })}
      </section>
    </>
  );
}
