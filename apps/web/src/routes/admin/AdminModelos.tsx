/**
 * Painel /admin/modelos — edita o modelo OpenRouter usado em cada estágio.
 * Cada row vira um insert/update em `app_settings` via RPC admin_set_setting.
 */

import { useState } from 'react';
import { useAppSettings, useSetAppSetting } from '../../hooks/useAppSettings';
import { useToast } from '../../components/Toast';

const STAGE_LABEL: Record<string, string> = {
  model_classify:         'Classificação',
  model_synthesize:       'Síntese',
  model_compress_compact: 'Cola (compacta)',
  model_compress_cola:    'Cola (estendida)',
  model_judge:            'Judge / validação',
  model_vision:           'Visão (OCR)',
};

interface RowProps {
  settingKey: string;
  current: string;
  description: string | null;
  updatedAt: string;
}

function ModelRow({ settingKey, current, description, updatedAt }: RowProps) {
  const [value, setValue] = useState(current);
  const setSetting = useSetAppSetting();
  const toast = useToast();
  const dirty = value !== current;
  const stageLabel = STAGE_LABEL[settingKey] ?? settingKey;

  const handleSave = async () => {
    try {
      await setSetting.mutateAsync({ key: settingKey, value });
      toast.success('Modelo atualizado', `${stageLabel} agora usa ${value}.`);
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
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="provider/modelo"
        spellCheck={false}
        aria-label={`Modelo para ${stageLabel}`}
      />
      <div className="admin-model-row-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => setValue(current)}
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
            Configure o modelo OpenRouter usado em cada estágio do pipeline. As mudanças são lidas pelas Edge Functions
            em até 60s (cache TTL). Formato: <code>provider/modelo</code> — ex: <code>openai/gpt-4o-mini</code>.
            Lista de modelos: <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">openrouter.ai/models</a>.
          </p>
        </div>
      </header>

      <section>
        {(settings ?? []).map((s) => (
          <ModelRow
            key={s.key}
            settingKey={s.key}
            current={typeof s.value === 'string' ? s.value : JSON.stringify(s.value)}
            description={s.description}
            updatedAt={s.updated_at}
          />
        ))}
      </section>
    </>
  );
}
