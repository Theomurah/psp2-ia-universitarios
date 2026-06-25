/**
 * Página /flashcards/import — importar baralho (Fase 4, frente 1.2).
 *
 * Aceita `.apkg` (Anki) e `.csv/.tsv/.txt` (frente, verso[, tags]). O parser
 * binário do .apkg (sql.js/jszip, pesado) é carregado via import() dinâmico só
 * quando um .apkg é escolhido. Mostra prévia (com LaTeX) antes de confirmar.
 */

import { Suspense, lazy, useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import { parseDelimited, type ParsedCard } from '@psp2/shared';
import { useImportDeck } from '../hooks/useFlashcards';
import { useToast } from '../components/Toast';

const MathMarkdown = lazy(() => import('../components/MathMarkdown'));

type Source = 'apkg' | 'csv';
interface Parsed {
  name: string;
  cards: ParsedCard[];
  source: Source;
}

const ERROR_MSG: Record<string, string> = {
  apkg_sem_collection: 'Esse .apkg não tem uma coleção reconhecível.',
  apkg_sem_notas: 'Nenhum cartão encontrado no arquivo.',
  sem_cartoes: 'Nenhum cartão reconhecido. Esperado: frente, verso por linha.',
  formato_invalido: 'Formato não suportado. Use .apkg, .csv, .tsv ou .txt.',
};

const TEXT_EXT = ['.csv', '.tsv', '.txt'];

export default function FlashcardImportPage() {
  const navigate = useNavigate();
  const importDeck = useImportDeck();
  const toast = useToast();
  const [status, setStatus] = useState<'idle' | 'parsing' | 'preview'>('idle');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setStatus('parsing');
    try {
      const lower = file.name.toLowerCase();
      let result: Parsed;
      if (lower.endsWith('.apkg')) {
        const { parseApkg } = await import('../lib/apkg');
        const r = await parseApkg(file);
        result = { name: r.name, cards: r.cards, source: 'apkg' };
      } else if (TEXT_EXT.some((e) => lower.endsWith(e))) {
        const cards = parseDelimited(await file.text());
        if (cards.length === 0) throw new Error('sem_cartoes');
        result = { name: file.name.replace(/\.[^.]+$/, '') || 'Baralho importado', cards, source: 'csv' };
      } else {
        throw new Error('formato_invalido');
      }
      setParsed(result);
      setName(result.name);
      setStatus('preview');
    } catch (e) {
      const code = (e as Error).message;
      setError(ERROR_MSG[code] ?? 'Não consegui ler o arquivo. Verifique o formato.');
      setStatus('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  const reset = () => {
    setStatus('idle');
    setParsed(null);
    setError(null);
  };

  const doImport = () => {
    if (!parsed) return;
    importDeck.mutate(
      { name: name.trim() || parsed.name, source: parsed.source, cards: parsed.cards },
      {
        onSuccess: ({ deckId, count }) => {
          toast.success(`${count} ${count === 1 ? 'cartão importado' : 'cartões importados'}`, 'Pronto pra estudar.');
          navigate(`/flashcards/decks/${deckId}`);
        },
        onError: () => toast.error('Não deu pra importar o baralho.'),
      },
    );
  };

  return (
    <div className="container">
      <header className="dashboard-header">
        <div>
          <h1>Importar baralho</h1>
          <p className="hint">
            Aceita <strong>.apkg</strong> (Anki) e <strong>.csv / .tsv / .txt</strong> (frente,
            verso e, opcionalmente, tags por linha).
          </p>
        </div>
        <Link to="/flashcards" className="ghost" style={{ textDecoration: 'none' }}>
          Voltar
        </Link>
      </header>

      {status !== 'preview' && (
        <div {...getRootProps()} className={`fc-dropzone${isDragActive ? ' active' : ''}`}>
          <input {...getInputProps()} />
          {status === 'parsing' ? (
            <div className="full-page-loader">
              <span className="spinner" />
              <span>Lendo o arquivo…</span>
            </div>
          ) : (
            <p>
              Arraste um arquivo aqui ou clique pra escolher.
              <br />
              <span className="hint">.apkg · .csv · .tsv · .txt</span>
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="empty" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {status === 'preview' && parsed && (
        <>
          <div className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label className="field">
              <span>Nome do baralho</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="hint">
              {parsed.cards.length} {parsed.cards.length === 1 ? 'cartão reconhecido' : 'cartões reconhecidos'} ·
              origem {parsed.source === 'apkg' ? 'Anki (.apkg)' : 'texto'}.
            </p>
            <div className="actions-row">
              <button type="button" className="primary" onClick={doImport} disabled={importDeck.isPending}>
                {importDeck.isPending ? 'Importando…' : `Importar ${parsed.cards.length} cartões`}
              </button>
              <button type="button" className="ghost" onClick={reset} disabled={importDeck.isPending}>
                Trocar arquivo
              </button>
            </div>
          </div>

          <h2 style={{ fontSize: '1rem' }}>
            Prévia (primeiros {Math.min(8, parsed.cards.length)})
          </h2>
          <div className="fc-card-list">
            {parsed.cards.slice(0, 8).map((c, i) => (
              <article key={i} className="fc-card-item">
                <div className="fc-card-faces">
                  <div className="fc-card-face">
                    <Suspense fallback={<span className="muted">…</span>}>
                      <MathMarkdown content={c.front} />
                    </Suspense>
                  </div>
                  <div className="fc-card-face fc-card-back">
                    <Suspense fallback={<span className="muted">…</span>}>
                      <MathMarkdown content={c.back} />
                    </Suspense>
                  </div>
                </div>
                {(c.tags.length > 0 || c.topico) && (
                  <div className="fc-card-tags">
                    {c.topico && <span className="badge tone-info">{c.topico}</span>}
                    {c.tags.map((t) => (
                      <span key={t} className="muted">#{t}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
