/**
 * T17 — Tela de cadastro / login.
 *
 * Suporta:
 * - Login com email + senha (sem regra de força — aceita senhas antigas)
 * - Cadastro com email + senha forte + nome + aceite LGPD
 * - Magic link (one-time code por email)
 * - Botão "Entrar com Google" desabilitado com tooltip (espera config OAuth — H6/Sprint 2)
 *
 * [extra] Layout split-screen com identidade UnB + toasts em todos os fluxos.
 * [security] Senha de signup ≥12 chars com complexidade; consentimento LGPD obrigatório.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordSchema, passwordStrength } from '@psp2/shared';
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from '../hooks/useAuth';
import { recordConsent, TOS_VERSION, PRIVACY_VERSION } from '../lib/consents';
import { useToast } from '../components/Toast';
import UnbLogo from '../components/UnbLogo';
import { createLogger, emailDomain } from '../lib/log';

const log = createLogger('login');

type Mode = 'signin' | 'signup' | 'magic';

const SignInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

const SignUpSchema = z.object({
  email: z.string().email('Email inválido'),
  password: PasswordSchema,
  full_name: z.string().min(2, 'Nome muito curto').max(100),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Você precisa aceitar os termos para continuar' }),
  }),
});

const MagicSchema = z.object({
  email: z.string().email('Email inválido'),
});

type FormValues = z.infer<typeof SignUpSchema>;

function describeAuthError(err: Error): { title: string; description?: string } {
  const msg = err.message.toLowerCase();
  if (msg.includes('invalid login credentials')) {
    return { title: 'Email ou senha incorretos' };
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return { title: 'Este email já está cadastrado', description: 'Tente fazer login ou recuperar a senha.' };
  }
  if (msg.includes('email not confirmed')) {
    return { title: 'Email não confirmado', description: 'Verifique sua caixa de entrada e clique no link de confirmação.' };
  }
  if (msg.includes('password should be') || msg.includes('weak password')) {
    return { title: 'Senha muito fraca', description: 'Use 12+ caracteres com maiúscula, minúscula e número.' };
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return { title: 'Muitas tentativas', description: 'Aguarde alguns segundos e tente de novo.' };
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return { title: 'Sem conexão', description: 'Verifique sua internet.' };
  }
  return { title: 'Não foi possível continuar', description: err.message };
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [magicSent, setMagicSent] = useState(false);
  const [signupConfirmSent, setSignupConfirmSent] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';

  const schema = mode === 'signup' ? SignUpSchema : mode === 'magic' ? MagicSchema : SignInSchema;

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting }, reset, getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(schema as typeof SignUpSchema),
    defaultValues: { consent: false as unknown as true },
  });

  const pw = watch('password') ?? '';
  const strength = mode === 'signup' ? passwordStrength(pw) : null;

  const onSubmit = async (data: FormValues) => {
    const domain = emailDomain(data.email);
    try {
      if (mode === 'signin') {
        await signInWithPassword(data.email, data.password);
        log.info('signin_succeeded', { email_domain: domain });
        toast.success('Bem-vindo de volta!', 'Login realizado com sucesso.');
        navigate(from, { replace: true });
      } else if (mode === 'signup') {
        const result = await signUpWithPassword(data.email, data.password, data.full_name);
        log.info('signup_succeeded', { email_domain: domain, needs_confirmation: !result.session });
        // Registra consentimento (LGPD) — best-effort, não bloqueia signup
        if (result.user) {
          recordConsent(result.user.id, [
            { type: 'tos', version: TOS_VERSION },
            { type: 'privacy', version: PRIVACY_VERSION },
          ]).catch((e) => log.warn('consent_record_failed', { user_id: result.user?.id, ...log.fromError(e) }));
        }
        if (result.session) {
          toast.success('Conta criada!', 'Vamos configurar seu perfil em alguns passos.');
          navigate('/onboarding', { replace: true });
        } else {
          setSignupConfirmSent(data.email);
          toast.info(
            'Confirme seu email',
            `Enviamos um link para ${data.email}. Abra o email e clique para ativar a conta.`,
          );
        }
      } else {
        await signInWithMagicLink(data.email);
        log.info('magic_link_sent', { email_domain: domain });
        setMagicSent(true);
        toast.info('Link enviado', `Verifique a caixa de entrada de ${data.email}.`);
      }
    } catch (err) {
      log.warn('auth_failed', { mode, email_domain: domain, ...log.fromError(err) });
      const { title, description } = describeAuthError(err as Error);
      toast.error(title, description);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setMagicSent(false);
    setSignupConfirmSent(null);
    reset();
  };

  const resendConfirmation = async () => {
    const email = signupConfirmSent ?? getValues('email');
    if (!email) return;
    try {
      await signInWithMagicLink(email);
      toast.success('Email reenviado', `Verifique a caixa de entrada de ${email}.`);
    } catch (err) {
      const { title, description } = describeAuthError(err as Error);
      toast.error(title, description);
    }
  };

  return (
    <div className="login-container">
      <aside className="login-side">
        <UnbLogo size={48} />
        <div className="login-pitch">
          <h2>Seu semestre, organizado pela IA.</h2>
          <p>
            Solte seus PDFs, slides e fotos do quadro. A gente classifica, resume e
            organiza tudo no seu Drive — pronto pra estudar.
          </p>
          <ul>
            <li>Síntese e cola automática por matéria</li>
            <li>Organização hierárquica no Google Drive</li>
            <li>Biblioteca de prompts pra IA do seu jeito</li>
          </ul>
        </div>
        <p className="login-footer">PSP2 · Universidade de Brasília · 2026.1</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          {magicSent ? (
            <>
              <h1>Verifique seu email</h1>
              <p className="hint">
                Enviamos um link para acesso. Abra o email e clique no link para entrar.
              </p>
              <button type="button" onClick={() => setMagicSent(false)} className="link">
                ← Voltar
              </button>
            </>
          ) : signupConfirmSent ? (
            <>
              <h1>Confirme seu email</h1>
              <p className="hint">
                Enviamos um link de confirmação para <strong>{signupConfirmSent}</strong>.
                Abra o email e clique no link para ativar sua conta.
              </p>
              <div className="actions-row" style={{ justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'stretch' }}>
                <button type="button" onClick={resendConfirmation} className="secondary">
                  Reenviar email de confirmação
                </button>
                <button type="button" onClick={() => switchMode('signin')} className="link">
                  ← Voltar pro login
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>
                {mode === 'signin' && 'Entrar'}
                {mode === 'signup' && 'Criar conta'}
                {mode === 'magic' && 'Acesso sem senha'}
              </h1>
              <p className="hint">
                {mode === 'signin' && 'Entre com sua conta para acessar seus documentos.'}
                {mode === 'signup' && 'Comece configurando seu semestre e matérias.'}
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
                  <label className="field">
                    <span>Nome completo</span>
                    <input type="text" autoComplete="name" placeholder="Theo Murah" {...register('full_name')} />
                    {errors.full_name && <em className="error">{errors.full_name.message}</em>}
                  </label>
                )}

                <label className="field">
                  <span>Email</span>
                  <input type="email" autoComplete="email" placeholder="seuemail@aluno.unb.br" {...register('email')} />
                  {errors.email && <em className="error">{errors.email.message}</em>}
                </label>

                {mode !== 'magic' && (
                  <label className="field">
                    <span>Senha</span>
                    <input
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      placeholder={mode === 'signup' ? 'Mínimo 12 caracteres' : '••••••'}
                      {...register('password')}
                    />
                    {mode === 'signup' && strength && pw.length > 0 && (
                      <div className={`pw-strength s${strength.score}`} aria-live="polite">
                        <div className="pw-strength-bar">
                          {[0, 1, 2, 3].map((i) => (
                            <span key={i} className={i < strength.score ? 'on' : ''} />
                          ))}
                        </div>
                        <small>Força: {strength.label}</small>
                      </div>
                    )}
                    {errors.password && <em className="error">{errors.password.message}</em>}
                  </label>
                )}

                {mode === 'signup' && (
                  <label className="field checkbox">
                    <input type="checkbox" {...register('consent')} />
                    <span>
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" rel="noopener">termos de uso</Link>
                      {' '}e a{' '}
                      <Link to="/privacidade" target="_blank" rel="noopener">política de privacidade</Link>.
                    </span>
                    {errors.consent && (
                      <em className="error" style={{ flexBasis: '100%' }}>{errors.consent.message as string}</em>
                    )}
                  </label>
                )}

                <button type="submit" className="primary" disabled={isSubmitting}>
                  {isSubmitting && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                  {mode === 'signin' && (isSubmitting ? 'Entrando…' : 'Entrar')}
                  {mode === 'signup' && (isSubmitting ? 'Criando conta…' : 'Criar conta')}
                  {mode === 'magic' && (isSubmitting ? 'Enviando…' : 'Enviar link mágico')}
                </button>
              </form>

              <div className="divider">ou</div>

              <button
                type="button"
                className="oauth"
                disabled
                title="Em breve — configuração OAuth pendente (H6 Sprint 2)"
              >
                <span>Entrar com Google</span>
                <small>(em breve)</small>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
