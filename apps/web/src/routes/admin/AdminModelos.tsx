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

const STAGE_LABEL: Record<string, string> = {
  model_classify:         'Classificação',
  model_synthesize:       'Síntese',
  model_compress_compact: 'Cola (compacta)',
  model_compress_cola:    'Cola (estendida)',
  model_judge:            'Judge / validação',
  model_vision:           'Visão (OCR)',
};

const CUSTOM_VALUE = '__custom__';

interface RowProps {
  settingKey: string;
  current: string;
  description: string | null;
  updatedAt: string;
  /** Disponibilidade por provider (null = desconhecido, ex: endpoint não deployado) */
  providers: Record<ProviderId, boolean> | null;
}

function ModelRow({ settingKey, current, description, updatedAt, providers }: RowProps) {
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

  const inCatalog = !!getCatalogModel(current);
  const [value, setValue] = useState(current);
  // Modo custom: campo de texto livre (qualquer ID OpenRouter/provider).
  const [custom, setCustom] = useState(false);

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

  return (
    <div className="admin-model-row">
      <div>
        <strong>{stageLabel}</strong>
        <p>
          <code>{settingKey}</code>
          {description && <span> — {description}</span>}
        </p>
        <small className="hint" style={{ fontSize: '0.72rem' }}>
          Atualizado {new Date(updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
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
            value={inCatalog ? value : current}
            onChange={(e) => handleSelect(e.target.value)}
            aria-label={`Modelo para ${stageLabel}`}
          >
            {/* Valor atual fora do catálogo (legado/custom) — sempre visível */}
            {!inCatalog && current && (
              <option value={current}>{current} (atual)</option>
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
        {(settings ?? []).map((s) => (
          <ModelRow
            key={s.key}
            settingKey={s.key}
            current={typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
            description={s.description}
            updatedAt={s.updated_at}
            providers={providers}
          />
        ))}
      </section>
    </>
  );
}
