/**
 * T21 — Tela de configuração (matérias, semestre)
 *
 * Onboarding obrigatório: aluno cadastra semestre atual + lista de matérias.
 * Esses dados são usados pelo prompt de classificação (T09) e pela criação
 * da estrutura de pastas no Drive (Execução Extra da T07).
 */

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProfileFormSchema, type ProfileForm } from '@psp2/shared';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: {
      full_name: '',
      semestre_atual: '2026.1',
      materias: [{ code: '', nome: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'materias' });

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? '',
        semestre_atual: profile.semestre_atual ?? '2026.1',
        materias: profile.materias.length > 0 ? profile.materias : [{ code: '', nome: '' }],
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileForm) => {
    await updateProfile.mutateAsync(data);
    alert('Configurações salvas!');
  };

  if (isLoading) return <p className="container">Carregando…</p>;

  return (
    <form className="container settings" onSubmit={handleSubmit(onSubmit)}>
      <h1>Configurações</h1>
      <p className="hint">
        Esses dados ajudam o sistema a classificar seus documentos automaticamente
        e a organizar tudo no seu Drive por semestre/matéria.
      </p>

      <label>
        <span>Nome completo</span>
        <input type="text" {...register('full_name')} />
        {errors.full_name && <em className="error">{errors.full_name.message}</em>}
      </label>

      <label>
        <span>Semestre atual</span>
        <input type="text" placeholder="2026.1" {...register('semestre_atual')} />
        {errors.semestre_atual && <em className="error">{errors.semestre_atual.message}</em>}
      </label>

      <h2>Matérias</h2>
      {fields.map((field, idx) => (
        <div key={field.id} className="materia-row">
          <input
            type="text"
            placeholder="FISICA3"
            {...register(`materias.${idx}.code` as const)}
          />
          <input
            type="text"
            placeholder="Física 3"
            {...register(`materias.${idx}.nome` as const)}
          />
          <button type="button" onClick={() => remove(idx)} disabled={fields.length === 1}>
            Remover
          </button>
        </div>
      ))}
      {errors.materias && <em className="error">{(errors.materias as { message?: string }).message ?? 'Verifique os campos das matérias'}</em>}

      <button type="button" onClick={() => append({ code: '', nome: '' })} className="secondary">
        + Adicionar matéria
      </button>

      <hr />

      <button type="submit" className="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}
