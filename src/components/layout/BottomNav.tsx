import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Menu, MessageSquare, Users } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext';
import { MoreSheet } from './MoreSheet';

const ITEMS = [
  { key: 'dashboard', label: 'Дашборд', path: '/admin', icon: LayoutDashboard },
  { key: 'bookings', label: 'Записи', path: '/admin/bookings', icon: CalendarDays },
  { key: 'messages', label: 'Сообщения', path: '/admin/messages', icon: MessageSquare, badge: true },
  { key: 'clients', label: 'Клиенты', path: '/admin/clients', icon: Users }
];

const MORE_PREFIXES = [
  '/admin/calendar',
  '/admin/services',
  '/admin/reviews',
  '/admin/analytics',
  '/admin/activity',
  '/admin/landing',
  '/admin/marketing',
  '/admin/settings'
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { badges } = useRealtime();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = MORE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <>
      <nav className="bottomnav" aria-label="Мобильная навигация">
        <div className="bottomnav__grid">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/admin' ? location.pathname === '/admin' : location.pathname === item.path;
            return (
              <button
                key={item.key}
                type="button"
                className="bottomnav__item"
                data-active={active}
                onClick={() => navigate(item.path)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                <span>{item.label}</span>
                {item.badge && badges.unreadMessages > 0 && (
                  <span className="bottomnav__badge">
                    {badges.unreadMessages > 9 ? '9+' : badges.unreadMessages}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            className="bottomnav__item"
            data-active={moreActive}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
          >
            <Menu />
            <span>Ещё</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
