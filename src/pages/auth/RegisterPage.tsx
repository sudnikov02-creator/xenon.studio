import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowLeft, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { AuthShell } from '../../components/layout/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-ZА-Я]/.test(password) && /[a-zа-я]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  if (score <= 2) return { label: 'Слабый', level: 1 };
  if (score <= 3) return { label: 'Средний', level: 2 };
  return { label: 'Надёжный', level: 3 };
}

export function RegisterPage() {
  const { user, status, hasAccount, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(() => strength(password), [password]);

  if (status === 'ready' && user) return <Navigate to="/admin" replace />;
  if (status === 'ready' && hasAccount) return <Navigate to="/login" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      toast({ title: 'Студия создана', subtitle: 'Добро пожаловать в xenon.studio', variant: 'success' });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать аккаунт');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="auth__form-title">Создание студии</h2>
      <p className="auth__form-sub">
        Первый запуск: база данных создаётся автоматически, осталось завести аккаунт фотографа. Клиенты
        регистрироваться не будут — они записываются по ссылке.
      </p>

      <div className="auth__setup">
        <span className="auth__setup-dot" aria-hidden />
        Настройки, расписание и статусы появятся сразу после регистрации
      </div>

      <form onSubmit={onSubmit} noValidate>
        {error && (
          <div className="auth-alert" role="alert" style={{ marginTop: 22 }}>
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="auth__fields">
          <label className="field">
            <span className="field__label">Ваше имя</span>
            <span className="input-wrap">
              <User />
              <input
                className="input"
                type="text"
                autoComplete="name"
                placeholder="Ксения Ветрова"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </span>
          </label>

          <label className="field">
            <span className="field__label">Email</span>
            <span className="input-wrap">
              <Mail />
              <input
                className="input"
                type="email"
                autoComplete="email"
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
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
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
            {password.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ display: 'flex', gap: 4, flex: 1 }}>
                  {[1, 2, 3].map((level) => (
                    <span
                      key={level}
                      style={{
                        height: 3,
                        flex: 1,
                        borderRadius: 999,
                        background:
                          passwordStrength.level >= level
                            ? passwordStrength.level === 1
                              ? 'var(--danger)'
                              : passwordStrength.level === 2
                                ? 'var(--warning)'
                                : 'var(--success)'
                            : 'var(--line-strong)',
                        transition: 'background 0.24s ease'
                      }}
                    />
                  ))}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{passwordStrength.label}</span>
              </span>
            )}
          </label>

          <label className="field">
            <span className="field__label">Повторите пароль</span>
            <span className="input-wrap">
              <Lock />
              <input
                className={`input${confirm && confirm !== password ? ' input--invalid' : ''}`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Ещё раз"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </span>
          </label>
        </div>

        <button
          type="submit"
          className={`btn btn--primary btn--lg btn--block auth__submit${loading ? ' btn--loading' : ''}`}
          disabled={loading}
        >
          Создать студию
          <ArrowRight />
        </button>
      </form>

      <div className="auth__foot">
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} /> У меня уже есть аккаунт
        </Link>
      </div>
    </AuthShell>
  );
}
