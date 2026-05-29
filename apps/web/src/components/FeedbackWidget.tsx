/**
 * Widget de avaliação de síntese (H10).
 *
 * Aparece no preview de um job concluído. Coleta nota (1-5), tópico e comentário
 * opcional e insere direto na tabela `feedback` via RLS (feedback_insert_own).
 * Se o usuário já avaliou este job, mostra um estado compacto de "obrigado".
 */

import { useState } from 'react';
import { FEEDBACK_TOPICS, FEEDBACK_TOPIC_LABELS, type FeedbackTopic } from '@psp2/shared';
import { useJobFeedback, useSubmitFeedback } from '../hooks/useFeedback';
import { useToast } from './Toast';

export default function FeedbackWidget({ jobId }: { jobId: string }) {
  const { data: existing, isLoading } = useJobFeedback(jobId);
  const submit = useSubmitFeedback();
  const toast = useToast();

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [topic, setTopic] = useState<FeedbackTopic>('sintese');
  const [comments, setComments] = useState('');

  // Evita piscar o formulário antes de sabermos se já há avaliação.
  if (isLoading) return null;

  if (existing) {
    return (
      <section className="feedback-widget feedback-done" aria-label="Avaliação enviada">
        <p className="feedback-done-title">
          <span aria-hidden="true">✓</span> Obrigado pela avaliação!
        </p>
        <p className="hint">
          Você avaliou esta síntese com <strong>{existing.rating}/5</strong>
          {' · '}{FEEDBACK_TOPIC_LABELS[existing.topic]}.
        </p>
      </section>
    );
  }

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.warning('Escolha uma nota', 'Toque nas estrelas para dar de 1 a 5.');
      return;
    }
    try {
      await submit.mutateAsync({ jobId, rating, topic, comments });
      toast.success('Feedback enviado', 'Valeu! Isso ajuda a melhorar as sínteses.');
    } catch (err) {
      toast.error('Não foi possível enviar', (err as Error).message);
    }
  };

  const display = hover || rating;

  return (
    <section className="feedback-widget" aria-label="Avaliar síntese">
      <h3 className="feedback-title">Avalie esta síntese</h3>

      <div className="feedback-stars" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            className={`feedback-star ${n <= display ? 'on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>

      <label className="field">
        <span>Sobre o quê?</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value as FeedbackTopic)}>
          {FEEDBACK_TOPICS.map((t) => (
            <option key={t} value={t}>{FEEDBACK_TOPIC_LABELS[t]}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Comentário (opcional)</span>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="O que funcionou bem ou o que faltou?"
        />
      </label>

      <div className="actions-row">
        <button type="button" className="primary" onClick={handleSubmit} disabled={submit.isPending}>
          {submit.isPending ? 'Enviando…' : 'Enviar avaliação'}
        </button>
      </div>
    </section>
  );
}
