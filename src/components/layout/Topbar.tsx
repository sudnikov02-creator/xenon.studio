import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  ChevronDown,
  Download,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  Star,
  User,
  Wifi,
  WifiOff
} from 'lucide-react';
import { ROUTE_META } from '../../app/navigation';
import { BrandMark } from '../ui/BrandMark';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useDismissable } from '../../hooks/useDismissable';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { api } from '../../lib/api';
import { initials, relativeTime } from '../../lib/utils';
import type { NotificationItem } from '../../types';
import { QuickBookingModal } from './QuickBookingModal';

const KIND_ICON = {
  booking: CalendarDays,
  message: MessageSquare,
  review: Star,
  system: Sparkles
} as const;

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { branding } = useSettings();
  const { badges, connected } = useRealtime();
  const { toast } = useToast();
  const { canInstall, install } = usePwaInstall();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const notifRef = useDismissable<HTMLDivElement>(notifOpen, closeNotif);
  const profileRef = useDismissable<HTMLDivElement>(profileOpen, closeProfile);
  const { subscribe } = useRealtime();

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get<{ items: NotificationItem[] }>('/notifications?limit=20');
      setNotifications(data.items);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    return subscribe('notification', (payload) => {
      const item = payload as NotificationItem;
      if (!item?.id) return;
      setNotifications((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)].slice(0, 24));
      toast({
        title: item.title,
        subtitle: item.subtitle || undefined,
        action: item.actionUrl
          ? {
              label: item.actionLabel || 'Открыть',
              onClick: () => navigate(item.actionUrl as string)
            }
          : undefined
      });
    });
  }, [subscribe, toast, navigate]);

  const unread = badges.unreadNotifications;

  const context = useMemo(() => {
    const meta = ROUTE_META[location.pathname];
    return meta?.title || '';
  }, [location.pathname]);

  const handleOpenNotification = async (item: NotificationItem) => {
    setNotifications((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isRead: 1 } : entry)));
    try {
      await api.post(`/notifications/${item.id}/read`);
    } catch {
      /* silent */
    }
    if (item.actionUrl) {
      setNotifOpen(false);
      navigate(item.actionUrl);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: 1 })));
    try {
      await api.post('/notifications/read-all');
      toast({ title: 'Уведомления прочитаны', variant: 'success', duration: 2600 });
    } catch {
      toast({ title: 'Не удалось обновить уведомления', variant: 'error' });
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar__left">
          <div className="topbar__mobile-logo">
            <BrandMark size={30} title={branding.siteName} />
            <span>{branding.siteName}</span>
          </div>
          <div className="topbar__brand">
            <BrandMark size={26} />
            <span className="topbar__site">{branding.siteName}</span>
          </div>
          <span className="topbar__divider" />
          <span className="topbar__context">{context}</span>
        </div>

        <div className="topbar__right">
          <button
            type="button"
            className="btn btn--primary quick-btn"
            onClick={() => setQuickOpen(true)}
            aria-label="Быстрая запись"
          >
            <CalendarPlus />
            <span className="quick-btn__label">Быстрая запись</span>
          </button>

          <div className="dropdown" ref={notifRef}>
            <button
              type="button"
              className="btn btn--icon btn--bordered bell-btn"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label={unread > 0 ? `Уведомления, ${unread} новых` : 'Уведомления'}
              aria-expanded={notifOpen}
            >
              <Bell />
              {unread > 0 && <span className="bell__dot" />}
            </button>

            {notifOpen && (
              <div className="dropdown__panel notif-panel" role="dialog" aria-label="Уведомления">
                <div className="notif-panel__head">
                  <div>
                    <div className="notif-panel__title">Уведомления</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11.5,
                        color: connected ? 'var(--success)' : 'var(--muted-2)',
                        marginTop: 2
                      }}
                    >
                      {connected ? <Wifi style={{ width: 12, height: 12 }} /> : <WifiOff style={{ width: 12, height: 12 }} />}
                      {connected ? 'живое обновление' : 'подключение…'}
                    </div>
                  </div>
                  {unread > 0 && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={markAllRead}
                      style={{ height: 28 }}
                    >
                      <CheckCheck /> Прочитать
                    </button>
                  )}
                </div>
                <div className="notif-panel__list">
                  {notifications.length === 0 && (
                    <div className="notif-panel__empty">
                      <Bell />
                      <p>Пока тихо. Новые события появятся здесь.</p>
                    </div>
                  )}
                  {notifications.map((item) => {
                    const Icon = KIND_ICON[item.kind as keyof typeof KIND_ICON] || Bell;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="notif-item"
                        data-kind={item.kind}
                        data-unread={!item.isRead}
                        onClick={() => handleOpenNotification(item)}
                      >
                        <span className="notif-item__icon">
                          <Icon />
                        </span>
                        <span className="notif-item__body">
                          <span className="notif-item__title">
                            {!item.isRead && <span className="counter counter--dot" />}
                            {item.title}
                          </span>
                          {item.subtitle && <span className="notif-item__text">{item.subtitle}</span>}
                          <span className="notif-item__meta">
                            <span className="notif-item__time">{relativeTime(item.createdAt)}</span>
                            {item.actionLabel && <span className="notif-item__action">{item.actionLabel}</span>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="notif-panel__foot">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--block"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/admin/activity');
                    }}
                  >
                    Вся история действий
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="dropdown" ref={profileRef}>
            <button
              type="button"
              className="profile-btn"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotifOpen(false);
              }}
              aria-label="Меню профиля"
              aria-expanded={profileOpen}
            >
              <span className="avatar" style={{ '--size': '34px' } as CSSProperties}>
                {initials(user?.name || 'X')}
              </span>
              <span className="profile-btn__name">{user?.name}</span>
              <ChevronDown />
            </button>

            {profileOpen && (
              <div className="dropdown__panel" role="menu" aria-label="Профиль">
                <div
                  style={{
                    padding: '10px 11px 12px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--line)',
                    marginBottom: 5
                  }}
                >
                  <span className="avatar" style={{ '--size': '38px' } as CSSProperties}>
                    {initials(user?.name || 'X')}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650 }}>{user?.name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--muted-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {user?.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="dropdown__item"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/admin/settings/profile');
                  }}
                  role="menuitem"
                >
                  <User /> Профиль
                </button>
                <button
                  type="button"
                  className="dropdown__item"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/admin/settings/appearance');
                  }}
                  role="menuitem"
                >
                  <Settings /> Настройки студии
                </button>
                {canInstall && (
                  <button
                    type="button"
                    className="dropdown__item"
                    onClick={async () => {
                      setProfileOpen(false);
                      const installed = await install();
                      if (!installed) toast({ title: 'Установка отложена', variant: 'info' });
                    }}
                    role="menuitem"
                  >
                    <Download /> Установить приложение
                  </button>
                )}
                <div className="dropdown__divider" />
                <button
                  type="button"
                  className="dropdown__item dropdown__item--danger"
                  onClick={() => {
                    setProfileOpen(false);
                    void logout();
                  }}
                  role="menuitem"
                >
                  <LogOut /> Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <QuickBookingModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    </>
  );
}
