/**
 * Onboarding pós-cadastro — 4 steps.
 *
 *   1. Boas-vindas + nome
 *   2. Curso + semestre atual
 *   3. Matérias (código + nome)
 *   4. Horários por matéria (opcional)
 *
 * O guard `RequireAuth requireOnboarding` em App.tsx redireciona pra cá
 * sempre que o profile estiver incompleto.
 *
 * [extra] Feature inteira — não estava no backlog original (T17 tratava só do login).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProfileFormSchema, type ProfileForm, DIAS_SEMANA } from '@psp2/shared';
import { useProfile, useUpdateProfile, MissingCursoColumnError } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import UnbLogo from '../components/UnbLogo';

const DIA_LABEL: Record<string, string> = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
};

const TOTAL_STEPS = 4;
const CODE_REGEX = /^[A-Z][A-Z0-9_]+$/;

/** Linha de matéria considerada "vazia" — usuário adicionou e não preencheu nada. */
function isMateriaEmpty(m: { code?: string; nome?: string }): boolean {
  return !(m.code ?? '').trim() && !(m.nome ?? '').trim();
}

/** Retorna a primeira razão pela qual o passo atual está bloqueado, ou null se ok. */
function blockReason(step: number, v: ProfileForm): string | null {
  if (step === 1) {
    if (!v.full_name?.trim() || v.full_name.trim().length < 2) {
      return 'Informe seu nome (mínimo 2 caracteres).';
    }
    return null;
  }
  if (step === 2) {
    if (!/^\d{4}\.\d$/.test(v.semestre_atual ?? '')) {
      return 'Use o formato AAAA.S no semestre (ex: 2026.1).';
    }
    return null;
  }
  if (step === 3) {
    const naoVazias = v.materias.filter((m) => !isMateriaEmpty(m));
    if (naoVazias.length === 0) {
      return 'Adicione pelo menos uma matéria com código e nome.';
    }
    const codeInvalido = naoVazias.find((m) => !CODE_REGEX.test(m.code ?? ''));
    if (codeInvalido) {
      return `Código "${codeInvalido.code || '(vazio)'}" inválido — use UPPERCASE sem espaços (ex: FISICA3).`;
    }
    const nomeFaltando = naoVazias.find((m) => !(m.nome ?? '').trim() || (m.nome ?? '').trim().length < 2);
    if (nomeFaltando) {
      return `Preencha o nome da matéria "${nomeFaltando.code}".`;
    }
    return null;
  }
  return null;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [step, setStep] = useState(1);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      curso: '',
      semestre_atual: '2026.1',
      materias: [{ code: '', nome: '', horarios: [] }],
    },
  });

  // Pré-preencher com profile carregado (caso usuário volte ao onboarding)
  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name ?? (user?.user_metadata?.full_name as string ?? ''),
        curso: profile.curso ?? '',
        semestre_atual: profile.semestre_atual ?? '2026.1',
        materias: profile.materias.length > 0
          ? profile.materias
          : [{ code: '', nome: '', horarios: [] }],
      });
    } else if (user?.user_metadata?.full_name) {
      form.setValue('full_name', user.user_metadata.full_name as string);
    }
  }, [profile, user, form]);

  // Watch + recompute reason every render — `watch()` faz o componente re-renderizar.
  const watched = form.watch();
  const reason = blockReason(step, watched);
  const canAdvance = reason === null;

  const goNext = () => {
    // Antes de avançar do step 3, remove matérias 100% vazias.
    if (step === 3) {
      const cleaned = watched.materias.filter((m) => !isMateriaEmpty(m));
      if (cleaned.length !== watched.materias.length) {
        form.setValue('materias', cleaned, { shouldDirty: true });
      }
    }
    setStep((s) => s + 1);
  };

  const onFinish = async () => {
    // Limpa matérias vazias antes de submeter
    const cleaned = watched.materias.filter((m) => !isMateriaEmpty(m));
    form.setValue('materias', cleaned, { shouldDirty: true });

    const data = { ...form.getValues(), materias: cleaned };
    const valid = await form.trigger();
    if (!valid) {
      toast.warning('Revise os campos', 'Existem campos inválidos no formulário.');
      return;
    }
    try {
      await updateProfile.mutateAsync(data);
      toast.success('Tudo pronto!', 'Seu perfil está configurado.');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof MissingCursoColumnError) {
        // Perfil foi salvo (sem o curso) — avisa e segue.
        toast.warning(
          'Curso não foi salvo',
          'A coluna "curso" ainda não existe no banco. Aplique a migration 0003 (veja docs/PENDENCIAS.md). O resto do perfil foi salvo.',
        );
        navigate('/', { replace: true });
        return;
      }
      toast.error('Não foi possível salvar', (err as Error).message);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <header className="onboarding-header">
          <UnbLogo size={36} />
          <div className="onboarding-steps" aria-label={`Passo ${step} de ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`onboarding-step-dot ${
                  i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''
                }`}
              />
            ))}
          </div>
        </header>

        {step === 1 && <StepWelcome form={form} />}
        {step === 2 && <StepCourse form={form} />}
        {step === 3 && <StepMaterias form={form} />}
        {step === 4 && <StepHorarios form={form} />}

        {/* Mensagem explicando por que o botão está desabilitado */}
        {reason && (
          <p className="onboarding-block-reason" role="status">
            ⓘ {reason}
          </p>
        )}

        <div className="onboarding-actions">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="ghost">
              ← Voltar
            </button>
          ) : (
            <span />
          )}
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              className="primary"
              onClick={goNext}
              disabled={!canAdvance}
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={onFinish}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? 'Salvando…' : 'Concluir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ form }: { form: UseFormReturn<ProfileForm> }) {
  return (
    <>
      <h1>Bem-vindo ao PSP2!</h1>
      <p className="hint">
        Vamos configurar seu perfil em alguns passos rápidos. Você poderá editar tudo depois em Configurações.
      </p>
      <div className="onboarding-body">
        <label className="field">
          <span>Como devemos te chamar?</span>
          <input type="text" placeholder="Theo Murah" {...form.register('full_name')} />
          {form.formState.errors.full_name && (
            <em className="error">{form.formState.errors.full_name.message}</em>
          )}
        </label>
      </div>
    </>
  );
}

function StepCourse({ form }: { form: UseFormReturn<ProfileForm> }) {
  return (
    <>
      <h1>Seu curso e semestre</h1>
      <p className="hint">
        Usamos isso para estruturar a pasta no Drive (ex: <code>2026.1/Física 3/</code>).
      </p>
      <div className="onboarding-body">
        <label className="field">
          <span>Curso</span>
          <input type="text" placeholder="Engenharia de Produção" {...form.register('curso')} />
          {form.formState.errors.curso && (
            <em className="error">{form.formState.errors.curso.message}</em>
          )}
        </label>
        <label className="field">
          <span>Semestre atual</span>
          <input type="text" placeholder="2026.1" {...form.register('semestre_atual')} />
          {form.formState.errors.semestre_atual && (
            <em className="error">{form.formState.errors.semestre_atual.message}</em>
          )}
        </label>
      </div>
    </>
  );
}

function StepMaterias({ form }: { form: UseFormReturn<ProfileForm> }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'materias' });

  // Auto-converte o code: UPPERCASE + remove caracteres inválidos enquanto digita.
  // Esse `onChange` é chamado depois do `onChange` do react-hook-form, então o valor
  // já foi capturado pelo RHF — precisamos atualizar ele via setValue.
  const sanitizeCode = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (cleaned !== raw) {
      form.setValue(`materias.${idx}.code`, cleaned, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <>
      <h1>Suas matérias</h1>
      <p className="hint">
        Adicione cada matéria do semestre. O <strong>código curto</strong> precisa ser em
        UPPERCASE, sem espaços (ex: <code>FISICA3</code>, <code>CALC3</code>).
      </p>
      <div className="onboarding-body">
        {fields.map((field, idx) => {
          const codeError = form.formState.errors.materias?.[idx]?.code?.message;
          const nomeError = form.formState.errors.materias?.[idx]?.nome?.message;
          return (
            <div key={field.id}>
              <div className="materia-row">
                <input
                  type="text"
                  placeholder="FISICA3"
                  aria-label="Código curto"
                  {...form.register(`materias.${idx}.code` as const, {
                    onChange: sanitizeCode(idx),
                  })}
                />
                <input
                  type="text"
                  placeholder="Física 3"
                  aria-label="Nome da matéria"
                  {...form.register(`materias.${idx}.nome` as const)}
                />
                <div />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="ghost"
                  disabled={fields.length === 1}
                  aria-label="Remover matéria"
                  title="Remover matéria"
                >
                  ✕
                </button>
              </div>
              {(codeError || nomeError) && (
                <div style={{ marginTop: '0.25rem', paddingLeft: '0.2rem' }}>
                  {codeError && <em className="error">{codeError}</em>}
                  {codeError && nomeError && <span style={{ margin: '0 0.4rem' }}>·</span>}
                  {nomeError && <em className="error">{nomeError}</em>}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => append({ code: '', nome: '', horarios: [] })} className="secondary">
          + Adicionar matéria
        </button>
      </div>
    </>
  );
}

function StepHorarios({ form }: { form: UseFormReturn<ProfileForm> }) {
  const materias = form.watch('materias');
  return (
    <>
      <h1>Horários (opcional)</h1>
      <p className="hint">
        Adicione os horários de cada matéria — útil pra lembretes e sugestões automáticas. Pode pular se preferir.
      </p>
      <div className="onboarding-body">
        {materias.map((m, idx) => {
          const horarios = m.horarios ?? [];
          return (
            <div key={idx} className="settings-section" style={{ background: 'var(--bg-muted)', boxShadow: 'none' }}>
              <strong>{m.code || '—'} · {m.nome || 'Sem nome'}</strong>
              <div className="horario-grid">
                {horarios.map((_, hIdx) => (
                  <div key={hIdx} className="horario-row">
                    <select {...form.register(`materias.${idx}.horarios.${hIdx}.dia` as const)}>
                      {DIAS_SEMANA.map((d) => (
                        <option key={d} value={d}>{DIA_LABEL[d]}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      aria-label="Início"
                      {...form.register(`materias.${idx}.horarios.${hIdx}.inicio` as const)}
                    />
                    <input
                      type="time"
                      aria-label="Fim"
                      {...form.register(`materias.${idx}.horarios.${hIdx}.fim` as const)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = form.getValues(`materias.${idx}.horarios`) ?? [];
                        form.setValue(
                          `materias.${idx}.horarios`,
                          current.filter((_, i) => i !== hIdx),
                          { shouldDirty: true },
                        );
                      }}
                      className="ghost"
                      aria-label="Remover horário"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const current = form.getValues(`materias.${idx}.horarios`) ?? [];
                    form.setValue(`materias.${idx}.horarios`, [
                      ...current,
                      { dia: 'seg', inicio: '08:00', fim: '10:00' },
                    ], { shouldDirty: true });
                  }}
                  className="link"
                >
                  + Adicionar horário
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
