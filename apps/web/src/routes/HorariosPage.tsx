/**
 * Tela "Minhas matérias e horários" — visualização principal da grade
 * + import SIGAA + atalho de edição manual (Settings).
 *
 * Estados:
 *   1. Sem matérias → hero/CTA grande (importar OU adicionar manual)
 *   2. Matérias sem horários → lista em cards horizontais + aviso
 *   3. Matérias com horários → grade visual + lista
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MateriaPerfil, SigaaAtestado } from '@psp2/shared';
import HorariosGrade from '../components/HorariosGrade';
import ImportSigaaModal from '../components/ImportSigaaModal';
import { useProfile, useUpdateProfile, MissingCursoColumnError } from '../hooks/useProfile';
import { useToast } from '../components/Toast';
import { colorForMateria } from '../lib/materiaColor';
import { mergeMaterias, sigaaMateriasToPerfil } from '../lib/materias';

const DIA_LABEL: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb',
};

function summarizeHorarios(m: MateriaPerfil): string | null {
  if (!m.horarios || m.horarios.length === 0) return null;
  const byDay = new Map<string, { inicio: string; fim: string }[]>();
  for (const h of m.horarios) {
    const arr = byDay.get(h.dia) ?? [];
    arr.push({ inicio: h.inicio, fim: h.fim });
    byDay.set(h.dia, arr);
  }
  const order = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  return order
    .filter((d) => byDay.has(d))
    .map((d) => {
      const slots = byDay.get(d)!.map((s) => `${s.inicio}–${s.fim}`).join(', ');
      return `${DIA_LABEL[d]} ${slots}`;
    })
    .join(' · ');
}

export default function HorariosPage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const materias: MateriaPerfil[] = profile?.materias ?? [];

  const ordenadas = useMemo(
    () => [...materias].sort((a, b) => a.code.localeCompare(b.code)),
    [materias]
  );

  const comHorario = ordenadas.filter((m) => m.horarios && m.horarios.length > 0);
  const semHorario = ordenadas.filter((m) => !m.horarios || m.horarios.length === 0);
  const temHorarios = comHorario.length > 0;

  const handleImportConfirm = async (parsed: SigaaAtestado) => {
    if (!profile) return;
    const importadas = sigaaMateriasToPerfil(parsed);
    const merged = mergeMaterias(materias, importadas);
    try {
      await updateProfile.mutateAsync({
        full_name: profile.full_name ?? '',
        curso: profile.curso ?? parsed.curso ?? undefined,
        semestre_atual: parsed.semestre ?? profile.semestre_atual ?? '2026.1',
        materias: merged,
      });
      toast.success('Importado!', `${importadas.length} matéria(s) salva(s).`);
      setModalOpen(false);
    } catch (err) {
      if (err instanceof MissingCursoColumnError) {
        toast.warning('Curso não foi salvo', 'A migration 0003 ainda não foi aplicada. As matérias foram salvas.');
        setModalOpen(false);
        return;
      }
      toast.error('Não foi possível salvar', (err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="container">
        <div className="full-page-loader" style={{ minHeight: '40vh' }}>
          <span className="spinner" />
          <span>Carregando suas matérias…</span>
        </div>
      </div>
    );
  }

  // =============================================================
  // ESTADO 1 — sem matérias: hero/CTA grande, sem grade vazia
  // =============================================================
  if (materias.length === 0) {
    return (
      <div className="container horarios">
        <section className="horarios-hero">
          <div className="horarios-hero-icon" aria-hidden>🗓️</div>
          <h1>Sua grade do semestre</h1>
          <p className="hint">
            Visualize suas matérias e horários em um só lugar. Você pode importar
            direto do SIGAA ou cadastrar manualmente.
          </p>
          <div className="horarios-hero-actions">
            <button type="button" className="primary" onClick={() => setModalOpen(true)}>
              Importar do SIGAA
            </button>
            <Link to="/settings" className="ghost" style={{ textDecoration: 'none' }}>
              Cadastrar manualmente
            </Link>
          </div>
          <small className="hint horarios-hero-tip">
            O atestado de matrícula do SIGAA é processado em segundos.
            Recomendado pra começar.
          </small>
        </section>

        <ImportSigaaModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onConfirm={handleImportConfirm}
        />
      </div>
    );
  }

  // =============================================================
  // ESTADO 2 — matérias cadastradas: grade (se tiver horários) + lista
  // =============================================================
  return (
    <div className="container horarios">
      <header className="horarios-header">
        <div className="horarios-header-text">
          <h1>Minhas matérias</h1>
          <p className="hint">
            {profile?.semestre_atual ?? '2026.1'}
            {' · '}
            {materias.length} matéria{materias.length === 1 ? '' : 's'}
            {temHorarios ? '' : ' · sem horários cadastrados'}
          </p>
        </div>
        <div className="horarios-header-actions">
          <Link to="/settings" className="ghost" style={{ textDecoration: 'none' }}>
            Editar
          </Link>
          <button type="button" className="primary" onClick={() => setModalOpen(true)}>
            Importar do SIGAA
          </button>
        </div>
      </header>

      {/* Aviso quando há matérias mas falta horário */}
      {!temHorarios && (
        <div className="alert alert-info" role="status">
          <strong>Sem horários cadastrados</strong>
          <p>
            Importe o atestado do SIGAA pra ter sua grade visual automaticamente,
            ou adicione os horários manualmente em <Link to="/settings">Configurações</Link>.
          </p>
        </div>
      )}

      {/* Grade visual — só renderiza se houver pelo menos 1 horário */}
      {temHorarios && (
        <section className="horarios-grade-wrap">
          <HorariosGrade
            materias={comHorario}
            selectedCode={selectedCode}
            onSelectMateria={(code) => setSelectedCode((cur) => cur === code ? null : code)}
          />
        </section>
      )}

      {/* Lista de matérias — cards em grid responsivo */}
      <section className="horarios-cards-section">
        <h2 className="section-label">
          Todas as matérias <span className="count">({materias.length})</span>
        </h2>
        <div className="horarios-cards-grid">
          {ordenadas.map((m) => {
            const c = colorForMateria(m.code);
            const horarioResumo = summarizeHorarios(m);
            const isSelected = selectedCode === m.code;
            return (
              <button
                type="button"
                key={m.code}
                className={`materia-card-v2 ${isSelected ? 'selected' : ''}`}
                style={{ '--accent': c.bg } as React.CSSProperties}
                onClick={() => setSelectedCode((cur) => cur === m.code ? null : m.code)}
              >
                <div className="materia-card-v2-head">
                  <span className="materia-card-v2-code" style={{ background: c.bg, color: c.text }}>
                    {m.code}
                  </span>
                  {m.turma && <span className="materia-card-v2-turma">Turma {m.turma}</span>}
                </div>
                <div className="materia-card-v2-nome">{m.nome}</div>
                {horarioResumo ? (
                  <div className="materia-card-v2-horario">⏰ {horarioResumo}</div>
                ) : (
                  <div className="materia-card-v2-horario muted">⏰ Sem horário</div>
                )}
                {m.local && <div className="materia-card-v2-meta">📍 {m.local}</div>}
                {m.professor && <div className="materia-card-v2-meta">👤 {m.professor}</div>}
                {m.codigo_horario_sigaa && (
                  <div className="materia-card-v2-sigaa">SIGAA: {m.codigo_horario_sigaa}</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {semHorario.length > 0 && temHorarios && (
        <p className="hint" style={{ marginTop: '1rem', textAlign: 'center' }}>
          {semHorario.length} matéria(s) sem horário não aparecem na grade acima.
        </p>
      )}

      <ImportSigaaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}
