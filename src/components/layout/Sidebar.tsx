import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Settings2 } from 'lucide-react';
import { NAV_ITEMS, SETTINGS_ICONS, MARKETING_ICONS, type NavItem } from '../../app/navigation';
import { BrandMark } from '../ui/BrandMark';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useSettings } from '../../context/SettingsContext';
import { cn, initials } from '../../lib/utils';

type View = 'main' | 'marketing' | 'settings';

function groupForPath(pathname: string): View {
  if (pathname.startsWith('/admin/marketing')) return 'marketing';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  return 'main';
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useSettings();
  const { badges } = useRealtime();

  const [view, setView] = useState<View>(() => groupForPath(location.pathname));
  const [previous, setPrevious] = useState<View | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('left');
  const viewRef = useRef(view);

  const switchTo = (next: View) => {
    if (next === viewRef.current) return;
    setDirection(next === 'main' ? 'right' : 'left');
    setPrevious(viewRef.current);
    viewRef.current = next;
    setView(next);
  };

  useEffect(() => {
    if (!previous) return;
    const timer = window.setTimeout(() => setPrevious(null), 240);
    return () => window.clearTimeout(timer);
  }, [previous, view]);

  useEffect(() => {
    const group = groupForPath(location.pathname);
    if (group !== viewRef.current) switchTo(group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const go = (path: string) => {
    const group = groupForPath(path);
    if (group !== viewRef.current) switchTo(group);
    navigate(path);
  };

  const isActive = (item: NavItem) => {
    if (item.path === '/admin') return location.pathname === '/admin';
    if (item.children) return location.pathname.startsWith(`/admin/${item.key}`);
    return item.path ? location.pathname === item.path : false;
  };

  const unread = badges.unreadMessages;
  const pending = badges.pendingBookings;
  const badgeCount = (item: NavItem) =>
    item.badge === 'messages' ? unread : item.badge === 'pending' ? pending : 0;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    return (
      <button
        key={item.key}
        type="button"
        className="nav-item"
        data-active={active}
        onClick={() => {
          if (item.children) {
            switchTo(item.key as View);
          } else if (item.path) {
            go(item.path);
          }
        }}
        aria-current={active ? 'page' : undefined}
      >
        <Icon />
        <span className="nav-item__label">{item.label}</span>
        {badgeCount(item) > 0 && (
          <span className="counter" data-tone={item.badge === 'pending' ? 'pending' : undefined}>
            {badgeCount(item) > 99 ? '99+' : badgeCount(item)}
          </span>
        )}
        {item.children && <ChevronRight className="nav-item__chev" />}
      </button>
    );
  };

  const renderSubmenu = (group: View) => {
    const parent = NAV_ITEMS.find((item) => item.key === group);
    if (!parent?.children) return null;
    const icons = group === 'marketing' ? MARKETING_ICONS : SETTINGS_ICONS;
    return (
      <>
        <button type="button" className="menu-back" onClick={() => switchTo('main')}>
          <ArrowLeft />
          Назад
        </button>
        <div className="sidebar__section-label" style={{ paddingTop: 2 }}>
          {parent.label}
        </div>
        {parent.children.map((child) => {
          const Icon = icons[child.key];
          const active = location.pathname === child.path;
          return (
            <button
              key={child.key}
              type="button"
              className="nav-item"
              data-active={active}
              onClick={() => go(child.path)}
              aria-current={active ? 'page' : undefined}
              title={child.label}
            >
              <span className="nav-item__dot" />
              <span className="nav-item__label">{child.label}</span>
              {Icon && <Icon className="nav-item__chev" style={{ opacity: 0.35 }} />}
            </button>
          );
        })}
      </>
    );
  };

  const renderPane = (target: View) => {
    if (target === 'main') return NAV_ITEMS.map(renderNavItem);
    return renderSubmenu(target);
  };

  return (
    <aside className="sidebar" aria-label="Основная навигация">
      <div className="sidebar__brand">
        <BrandMark />
        <button type="button" className="sidebar__brand-btn" onClick={() => go('/admin')} aria-label="На дашборд">
          <span className="sidebar__name">{branding.siteName}</span>
          <span className="sidebar__caption">студия фотографа</span>
        </button>
      </div>

      <nav className="sidebar__nav">
        <div className="menu-view">
          {previous && (
            <div
              key={`prev-${previous}`}
              className={cn(
                'menu-pane',
                direction === 'left' ? 'menu-pane--exit-left' : 'menu-pane--exit-right'
              )}
              aria-hidden="true"
            >
              {renderPane(previous)}
            </div>
          )}
          <div
            key={view}
            className={cn('menu-pane', direction === 'left' ? 'menu-pane--enter-left' : 'menu-pane--enter-right')}
          >
            {renderPane(view)}
          </div>
        </div>
      </nav>

      <div className="sidebar__foot">
        <button type="button" className="user-chip" onClick={() => go('/admin/settings/profile')}>
          <span className="avatar" style={{ '--size': '34px' } as CSSProperties}>
            {initials(user?.name || branding.photographerName || 'X')}
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="user-chip__name" style={{ display: 'block' }}>
              {user?.name || branding.photographerName}
            </span>
            <span className="user-chip__role" style={{ display: 'block' }}>
              Фотограф
            </span>
          </span>
          <Settings2 className="user-chip__more" />
        </button>
      </div>
    </aside>
  );
}
