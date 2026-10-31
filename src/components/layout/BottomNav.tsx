import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Menu, MessageSquare, Users } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext';
import { MoreSheet } from './MoreSheet';

type BadgeKey = 'messages' | 'pending';

const ITEMS: { key: string; label: string; path: string; icon: typeof LayoutDashboard; badge?: BadgeKey }[] = [
  { key: 'dashboard', label: 'Дашборд', path: '/admin', icon: LayoutDashboard },
  { key: 'bookings', label: 'Записи', path: '/admin/bookings', icon: CalendarDays, badge: 'pending' },
  { key: 'messages', label: 'Сообщения', path: '/admin/messages', icon: MessageSquare, badge: 'messages' },
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
  const badgeCount = (item: { badge?: BadgeKey }) =>
    item.badge === 'messages' ? badges.unreadMessages : item.badge === 'pending' ? badges.pendingBookings : 0;
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
                {badgeCount(item) > 0 && (
                  <span className="bottomnav__badge" data-tone={item.badge === 'pending' ? 'pending' : undefined}>
                    {badgeCount(item) > 9 ? '9+' : badgeCount(item)}
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
