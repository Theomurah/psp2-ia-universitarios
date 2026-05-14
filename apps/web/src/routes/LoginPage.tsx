/**
 * T17 — Tela de cadastro / login.
 *
 * Suporta:
 * - Login com email + senha
 * - Cadastro com email + senha + nome
 * - Magic link (one-time code por email)
 * - Botão "Entrar com Google" desabilitado com tooltip (espera config OAuth — H6/Sprint 2)
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from '../hooks/useAuth';

type Mode = 'signin' | 'signup' | 'magic';

const SignInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
});

const SignUpSchema = SignInSchema.extend({
  full_name: z.string().min(2, 'Nome muito curto').max(100),
});

const MagicSchema = z.object({
  email: z.string().email('Email inválido'),
});

type FormValues = z.infer<typeof SignUpSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';

  const schema = mode === 'signup' ? SignUpSchema : mode === 'magic' ? MagicSchema : SignInSchema;

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    // @ts-expect-error — schema varia por mode
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(data.email, data.password);
        navigate(from, { replace: true });
      } else if (mode === 'signup') {
        await signUpWithPassword(data.email, data.password, data.full_name);
        navigate(from, { replace: true });
      } else {
        await signInWithMagicLink(data.email);
        setMagicSent(true);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setMagicSent(false);
    reset();
  };

  if (magicSent) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Verifique seu email</h1>
          <p>Enviamos um link mágico para entrar. Abra o email e clique no link.</p>
          <button onClick={() => setMagicSent(false)} className="link">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>PSP2 — IA para Universitários</h1>
        <p className="hint">
          {mode === 'signin' && 'Entre com sua conta para acessar seus documentos.'}
          {mode === 'signup' && 'Crie uma conta para começar.'}
          {mode === 'magic' && 'Enviaremos um link de acesso por email.'}
        </p>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => switchMode('signin')}
          >Entrar</button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >Criar conta</button>
          <button
            type="button"
            className={mode === 'magic' ? 'active' : ''}
            onClick={() => switchMode('magic')}
          >Link mágico</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {mode === 'signup' && (
            <label>
              <span>Nome completo</span>
              <input type="text" autoComplete="name" {...register('full_name')} />
              {errors.full_name && <em className="error">{errors.full_name.message}</em>}
            </label>
          )}

          <label>
            <span>Email</span>
            <input type="email" autoComplete="email" {...register('email')} />
            {errors.email && <em className="error">{errors.email.message}</em>}
          </label>

          {mode !== 'magic' && (
            <label>
              <span>Senha</span>
              <input
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                {...register('password')}
              />
              {errors.password && <em className="error">{errors.password.message}</em>}
            </label>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? '…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link mágico'}
          </button>
        </form>

        <div className="divider">ou</div>

        <button type="button" className="oauth" disabled title="Em breve — configuração OAuth pendente (H6 Sprint 2)">
          <span>Entrar com Google</span>
          <small>(em breve)</small>
        </button>
      </div>
    </div>
  );
}
