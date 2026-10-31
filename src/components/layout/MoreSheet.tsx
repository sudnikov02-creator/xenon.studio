import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, LogOut, Settings } from 'lucide-react';
import { NAV_ITEMS, MARKETING_ICONS, SETTINGS_ICONS } from '../../app/navigation';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { initials } from '../../lib/utils';

interface SheetLink {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
}

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { branding } = useSettings();

  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const startTime = useRef(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closing = useRef(false);

  useEffect(() => {
    if (!open) {
      setDrag(0);
      setDragging(false);
      closing.current = false;
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setDrag(window.innerHeight);
    window.setTimeout(() => {
      onClose();
      setDrag(0);
      closing.current = false;
    }, 220);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startY.current = event.clientY;
    startTime.current = Date.now();
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = event.clientY - startY.current;
    setDrag(Math.max(0, delta));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const delta = event.clientY - startY.current;
    const quick = Date.now() - startTime.current < 350;
    startY.current = null;
    setDragging(false);
    if (delta > 120 || (quick && delta > 46)) {
      handleClose();
    } else {
      setDrag(0);
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  const marketing = NAV_ITEMS.find((item) => item.key === 'marketing');
  const settings = NAV_ITEMS.find((item) => item.key === 'settings');

  const links: SheetLink[] = [
    { label: 'Календарь', path: '/admin/calendar', icon: NAV_ITEMS[2].icon },
    { label: 'Услуги', path: '/admin/services', icon: NAV_ITEMS[5].icon },
    { label: 'Отзывы', path: '/admin/reviews', icon: NAV_ITEMS[7].icon },
    { label: 'Аналитика', path: '/admin/analytics', icon: NAV_ITEMS[8].icon },
    { label: 'Журнал', path: '/admin/activity', icon: NAV_ITEMS[9].icon },
    { label: 'Лендинг', path: '/admin/landing', icon: NAV_ITEMS[10].icon },
    {
      label: 'Маркетинг',
      path: marketing?.children?.[0].path || '/admin/marketing/discounts',
      icon: MARKETING_ICONS.discounts
    },
    { label: 'Настройки', path: settings?.children?.[0].path || '/admin/settings/profile', icon: Settings }
  ];

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        data-dragging={dragging || undefined}
        style={{
          transform: `translateY(${drag}px)`,
          transition: dragging ? 'none' : 'transform 0.24s cubic-bezier(0.22, 0.72, 0.24, 1)'
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Все разделы"
      >
        <div
          style={{ touchAction: 'none', paddingBottom: 4 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet__handle" />
        </div>
        <div className="sheet__title">Все разделы</div>
        <div className="sheet__grid">
          {links.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.path;
            return (
              <button
                key={link.path}
                type="button"
                className="sheet__link"
                data-active={active}
                onClick={() => {
                  navigate(link.path);
                  handleClose();
                }}
              >
                <span className="sheet__link-icon">
                  <Icon />
                </span>
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="sheet__foot">
          <span className="avatar" style={{ '--size': '38px' } as CSSProperties}>
            {initials(user?.name || branding.photographerName || 'X')}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{user?.email}</div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => {
              navigate('/admin/settings/profile');
              handleClose();
            }}
            aria-label="Профиль"
          >
            <ArrowUpRight />
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={async () => {
              handleClose();
              await logout();
            }}
          >
            <LogOut /> Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
