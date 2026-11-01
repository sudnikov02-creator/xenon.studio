import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Camera,
  Check,
  Download,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  Smartphone,
  User
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { api, ApiError } from '../../lib/api';
import { formatDate, initials } from '../../lib/utils';

export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const { toast } = useToast();
  const { branding, updateSettings } = useSettings();
  const { canInstall, installed, install } = usePwaInstall();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [contacts, setContacts] = useState({ phone: '', telegram: '', instagram: '', email: '' });
  const [savingContacts, setSavingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    setContacts({
      phone: branding.contacts?.phone || '',
      telegram: branding.contacts?.telegram || '',
      instagram: branding.contacts?.instagram || '',
      email: branding.contacts?.email || ''
    });
  }, [branding.contacts]);

  const contactsDirty =
    contacts.phone !== (branding.contacts?.phone || '') ||
    contacts.telegram !== (branding.contacts?.telegram || '') ||
    contacts.instagram !== (branding.contacts?.instagram || '') ||
    contacts.email !== (branding.contacts?.email || '');

  const saveContacts = async (event: FormEvent) => {
    event.preventDefault();
    setContactsError(null);
    setSavingContacts(true);
    try {
      await updateSettings({ contacts });
      toast({ title: 'Контакты обновлены', subtitle: 'Клиенты увидят их на странице записи', variant: 'success' });
    } catch (err) {
      setContactsError(err instanceof ApiError ? err.message : 'Не удалось сохранить контакты');
    } finally {
      setSavingContacts(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user]);

  const profileDirty = name !== (user?.name || '') || email !== (user?.email || '');

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { name: name.trim(), email: email.trim() });
      await refresh();
      toast({ title: 'Профиль обновлён', subtitle: 'Данные сохранены', variant: 'success' });
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('Новый пароль должен содержать минимум 8 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Новые пароли не совпадают');
      return;
    }
    setSavingPassword(true);
    try {
      await api.post('/auth/password', user?.needsPassword ? { newPassword } : { currentPassword, newPassword });
      toast({ title: 'Пароль изменён', subtitle: 'Войдите заново с новым паролем', variant: 'success' });
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Не удалось изменить пароль');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        title="Профиль"
        subtitle="Данные фотографа и безопасность аккаунта"
        badge={<span className="badge badge--accent">Настройки</span>}
      />

      <div className="settings-grid">
        <div className="settings-column">
          <form className="card card--pad form-card" onSubmit={saveProfile}>
            <div className="section-head">
              <div>
                <div className="panel-title">Личные данные</div>
                <div className="panel-sub">Имя и email видны только вам</div>
              </div>
              <span className="avatar avatar--soft" style={{ '--size': '46px' } as CSSProperties}>
                {initials(name || 'X')}
              </span>
            </div>

            {profileError && (
              <div className="auth-alert" role="alert">
                <AlertCircle />
                <span>{profileError}</span>
              </div>
            )}

            <div className="form-row">
              <label className="field">
                <span className="field__label">Имя фотографа</span>
                <span className="input-wrap">
                  <User />
                  <input
                    className="input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    placeholder="Ваше имя"
                  />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Email для входа</span>
                <span className="input-wrap">
                  <Mail />
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="studio@xenon.studio"
                  />
                </span>
              </label>
            </div>

            <div className="form-actions">
              <span className="field__hint">Имя отображается в шапке панели и на странице записи.</span>
              <button
                type="submit"
                className={`btn btn--primary${savingProfile ? ' btn--loading' : ''}`}
                disabled={!profileDirty || savingProfile}
              >
                Сохранить
              </button>
            </div>
          </form>

          <form className="card card--pad form-card" onSubmit={saveContacts}>
            <div className="section-head">
              <div>
                <div className="panel-title">Контакты для клиентов</div>
                <div className="panel-sub">Показываются на личной странице записи /b/…</div>
              </div>
              <span className="next-card__icon">
                <Phone />
              </span>
            </div>

            {contactsError && (
              <div className="auth-alert" role="alert">
                <AlertCircle />
                <span>{contactsError}</span>
              </div>
            )}

            <div className="form-row">
              <label className="field">
                <span className="field__label">Телефон</span>
                <span className="input-wrap">
                  <Phone />
                  <input
                    className="input"
                    value={contacts.phone}
                    onChange={(event) => setContacts((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="+375 29 120-45-67"
                  />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Telegram</span>
                <span className="input-wrap">
                  <Send />
                  <input
                    className="input"
                    value={contacts.telegram}
                    onChange={(event) => setContacts((prev) => ({ ...prev, telegram: event.target.value }))}
                    placeholder="xenon_studio"
                  />
                </span>
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span className="field__label">Instagram</span>
                <span className="input-wrap">
                  <Camera />
                  <input
                    className="input"
                    value={contacts.instagram}
                    onChange={(event) => setContacts((prev) => ({ ...prev, instagram: event.target.value }))}
                    placeholder="xenon.studio"
                  />
                </span>
              </label>
              <label className="field">
                <span className="field__label">Почта</span>
                <span className="input-wrap">
                  <Mail />
                  <input
                    className="input"
                    type="email"
                    value={contacts.email}
                    onChange={(event) => setContacts((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="hello@xenon.studio"
                  />
                </span>
              </label>
            </div>

            <div className="form-actions">
              <span className="field__hint">Клиент сможет позвонить или написать в один клик.</span>
              <button
                type="submit"
                className={`btn btn--primary${savingContacts ? ' btn--loading' : ''}`}
                disabled={!contactsDirty || savingContacts}
              >
                Сохранить контакты
              </button>
            </div>
          </form>

          <form className="card card--pad form-card" onSubmit={savePassword}>
            <div className="section-head">
              <div>
                <div className="panel-title">Пароль</div>
                <div className="panel-sub">После смены пароля все сессии завершатся</div>
              </div>
              <span className="next-card__icon">
                <KeyRound />
              </span>
            </div>

            {user?.needsPassword && (
              <div className="profile-notice" role="status">
                <ShieldCheck />
                <span>
                  Студия восстановлена после перезапуска сервера — старый пароль больше не действует. Задайте
                  новый, чтобы вход оставался под защитой.
                </span>
              </div>
            )}

            {passwordError && (
              <div className="auth-alert" role="alert">
                <AlertCircle />
                <span>{passwordError}</span>
              </div>
            )}

            <div className={`form-row${user?.needsPassword ? ' form-row--two' : ' form-row--three'}`}>
              {!user?.needsPassword && (
              <label className="field">
                <span className="field__label">Текущий пароль</span>
                <input
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </label>
              )}
              <label className="field">
                <span className="field__label">Новый пароль</span>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Минимум 8 символов"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Повторите</span>
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Ещё раз"
                  required
                />
              </label>
            </div>

            <div className="form-actions">
              <span className="field__hint">Используйте буквы, цифры и символы.</span>
              <button
                type="submit"
                className={`btn btn--primary${savingPassword ? ' btn--loading' : ''}`}
                disabled={savingPassword}
              >
                Обновить пароль
              </button>
            </div>
          </form>
        </div>

        <aside className="settings-column">
          <section className="card card--pad">
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div className="panel-title">Аккаунт</div>
              <span className="badge badge--success">
                <span className="badge__dot" /> активен
              </span>
            </div>
            <div className="info-list">
              <div className="info-list__row">
                <span>Фотограф</span>
                <b>{user?.name}</b>
              </div>
              <div className="info-list__row">
                <span>Email</span>
                <b>{user?.email}</b>
              </div>
              <div className="info-list__row">
                <span>Последний вход</span>
                <b>
                  {user?.lastLoginAt
                    ? formatDate(user.lastLoginAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                    : 'сейчас'}
                </b>
              </div>
              <div className="info-list__row">
                <span>Доступ</span>
                <b>только фотограф</b>
              </div>
            </div>
            <div className="security-note">
              <ShieldCheck />
              <span>Сессия защищена httpOnly-cookie и действует 30 дней.</span>
            </div>
            <button
              type="button"
              className="btn btn--danger btn--block"
              style={{ marginTop: 14 }}
              onClick={() => void logout()}
            >
              <LogOut /> Выйти из студии
            </button>
          </section>

          <section className="card card--pad">
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div>
                <div className="panel-title">Приложение на телефон</div>
                <div className="panel-sub">Работает как обычное приложение</div>
              </div>
              <span className="next-card__icon">
                <Smartphone />
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              Установите xenon.studio на домашний экран: быстрый запуск, полноэкранный режим и офлайн-страница
              при потере сети.
            </p>
            {installed ? (
              <div className="checklist__item" style={{ marginTop: 12, fontSize: 12.5 }}>
                <span className="checklist__dot">
                  <Check />
                </span>
                Приложение установлено
              </div>
            ) : canInstall ? (
              <button
                type="button"
                className="btn btn--soft btn--block"
                style={{ marginTop: 14 }}
                onClick={async () => {
                  const done = await install();
                  if (done) toast({ title: 'Приложение установлено', variant: 'success' });
                }}
              >
                <Download /> Установить приложение
              </button>
            ) : (
              <div className="field__hint" style={{ marginTop: 12 }}>
                Откройте меню браузера и выберите «Установить приложение» или «На экран Домой».
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
