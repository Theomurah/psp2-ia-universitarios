/**
 * Seção LGPD na tela de Configurações:
 * - Exportar todos os meus dados (Art. 18 V — portabilidade)
 * - Excluir conta + dados (Art. 18 VI — eliminação)
 *
 * Ambos chamam RPCs Postgres com SECURITY DEFINER (definidas em 0006).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { exportUserData, deleteMyAccount, downloadAsFile } from '../lib/consents';
import { useToast } from './Toast';
import { createLogger } from '../lib/log';

const log = createLogger('privacy');

export default function PrivacySection() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'idle' | 'confirming'>('idle');

  const handleExport = async () => {
    setExporting(true);
    const t0 = Date.now();
    try {
      const data = await exportUserData();
      const json = JSON.stringify(data, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadAsFile(json, `psp2-meus-dados-${stamp}.json`);
      log.info('data_exported', { duration_ms: Date.now() - t0, bytes: json.length });
      toast.success('Dados exportados', 'O download começou.');
    } catch (err) {
      log.error('data_export_failed', log.fromError(err));
      toast.error('Falha ao exportar', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'EXCLUIR') {
      toast.warning('Confirmação inválida', 'Digite EXCLUIR exatamente para confirmar.');
      return;
    }
    setDeleting(true);
    log.info('account_delete_requested');
    try {
      await deleteMyAccount();
      toast.info('Conta excluída', 'Todos os seus dados foram removidos.');
      window.location.href = '/login';
    } catch (err) {
      log.error('account_delete_failed', log.fromError(err));
      toast.error('Falha ao excluir conta', (err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <section className="settings-section privacy-section">
      <h2>Privacidade e dados (LGPD)</h2>
      <p className="hint">
        Você tem direito de acessar, portar e excluir seus dados a qualquer momento
        (Lei 13.709/2018, Art. 18). Consulte a{' '}
        <Link to="/privacidade" target="_blank" rel="noopener">política de privacidade</Link>{' '}
        para detalhes.
      </p>

      <div className="privacy-action">
        <div>
          <strong>Exportar meus dados</strong>
          <p className="hint">
            Baixa um JSON com perfil, documentos, jobs, sínteses, prompts e consentimentos.
            Não inclui tokens OAuth nem senhas.
          </p>
        </div>
        <button type="button" className="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exportando…' : 'Exportar JSON'}
        </button>
      </div>

      <hr />

      <div className="privacy-action danger">
        <div>
          <strong>Excluir minha conta</strong>
          <p className="hint">
            Apaga conta, perfil, documentos, jobs, sínteses e prompts. <strong>Irreversível.</strong>
            {' '}Arquivos no seu Google Drive não são afetados — você mantém sua cópia.
          </p>
        </div>
        {step === 'idle' ? (
          <button type="button" className="danger" onClick={() => setStep('confirming')}>
            Excluir conta…
          </button>
        ) : (
          <div className="privacy-confirm">
            <input
              type="text"
              placeholder="Digite EXCLUIR para confirmar"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
            <div className="actions-row">
              <button
                type="button"
                className="danger"
                onClick={handleDelete}
                disabled={deleting || confirmText.trim().toUpperCase() !== 'EXCLUIR'}
              >
                {deleting ? 'Excluindo…' : 'Confirmar exclusão'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => { setStep('idle'); setConfirmText(''); }}
                disabled={deleting}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
