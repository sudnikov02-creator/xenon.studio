import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { AuthShell } from '../../components/layout/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { ApiError } from '../../lib/api';

export function LoginPage() {
  const { user, status, hasAccount, demoHint, login } = useAuth();
  const { branding } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/admin';

  if (status === 'ready' && user) return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast({ title: 'Добро пожаловать', subtitle: 'Вы вошли в студию', variant: 'success' });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    if (!demoHint) return;
    setEmail(demoHint.email);
    setPassword(demoHint.password);
    setError(null);
  };

  return (
    <AuthShell>
      <h2 className="auth__form-title">Вход в студию</h2>
      <p className="auth__form-sub">
        {branding.photographerName ? `${branding.photographerName}, введите данные доступа.` : 'Введите данные доступа фотографа.'}
      </p>

      <form onSubmit={onSubmit} noValidate>
        {error && (
          <div className="auth-alert" role="alert" style={{ marginTop: 22 }}>
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="auth__fields">
          <label className="field">
            <span className="field__label">Email</span>
            <span className="input-wrap">
              <Mail />
              <input
                className={`input${error ? '' : ''}`}
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="studio@xenon.studio"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </span>
          </label>

          <label className="field">
            <span className="field__label">Пароль</span>
            <span className="input-wrap">
              <Lock />
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="input-wrap__action"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className={`btn btn--primary btn--lg btn--block auth__submit${loading ? ' btn--loading' : ''}`}
          disabled={loading}
        >
          Войти
          <ArrowRight />
        </button>
      </form>

      {demoHint && (
        <div className="auth__demo">
          <span className="auth__demo-icon">
            <ShieldCheck />
          </span>
          <span className="auth__demo-text">
            Демо-доступ: <b>{demoHint.email}</b>
            <br />
            пароль <b>{demoHint.password}</b>
          </span>
          <button type="button" onClick={fillDemo}>
            Заполнить
          </button>
        </div>
      )}

      <div className="auth__foot">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Lock style={{ width: 13, height: 13 }} /> Доступ только для фотографа
        </span>
        {!hasAccount && status === 'ready' && (
          <Link to="/register">Создать студию</Link>
        )}
      </div>
    </AuthShell>
  );
}
