import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  GripVertical,
  LayoutGrid,
  MoreHorizontal,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDismissable } from '../../hooks/useDismissable';
import type { WidgetId } from '../../types';

interface WidgetFrameProps {
  id: WidgetId;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  count?: number;
  configurable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onConfigure: () => void;
  onHide: () => void;
  onMove: (direction: -1 | 1) => void;
  onOpenDashboardSettings: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, element: HTMLElement) => void;
  children: ReactNode;
  className?: string;
}

export function WidgetFrame({
  id,
  title,
  subtitle,
  icon: Icon,
  count,
  configurable,
  canMoveUp,
  canMoveDown,
  onConfigure,
  onHide,
  onMove,
  onOpenDashboardSettings,
  onDragStart,
  children,
  className
}: WidgetFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismissable<HTMLDivElement>(menuOpen, closeMenu);

  return (
    <section
      ref={sectionRef}
      className={cn('widget card', className)}
      data-widget-frame
      data-widget-id={id}
      aria-label={title}
    >
      <header className="widget__head">
        <span className="widget__icon">
          <Icon />
        </span>
        <div className="widget__titles">
          <h3 className="widget__title">{title}</h3>
          {subtitle && <p className="widget__sub">{subtitle}</p>}
        </div>
        {typeof count === 'number' && count > 0 && (
          <span className="counter counter--muted widget__count">{count}</span>
        )}
        <div className="widget__actions">
          <button
            type="button"
            className="widget__handle"
            aria-label={`Перетащить виджет «${title}»`}
            title="Перетащить"
            onPointerDown={(event) => {
              if (!sectionRef.current) return;
              onDragStart(event, sectionRef.current);
            }}
          >
            <GripVertical />
          </button>
          <div className="widget__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="widget__menu-btn"
              aria-label={`Настройки виджета «${title}»`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <MoreHorizontal />
            </button>
            {menuOpen && (
              <div className="widget-menu" role="menu">
                {configurable && (
                  <button
                    type="button"
                    className="widget-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onConfigure();
                    }}
                  >
                    <SlidersHorizontal /> Настроить виджет
                  </button>
                )}
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  disabled={!canMoveUp}
                  onClick={() => {
                    setMenuOpen(false);
                    onMove(-1);
                  }}
                >
                  <ChevronUp /> Переместить выше
                </button>
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  disabled={!canMoveDown}
                  onClick={() => {
                    setMenuOpen(false);
                    onMove(1);
                  }}
                >
                  <ChevronDown /> Переместить ниже
                </button>
                <div className="dropdown__divider" />
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onHide();
                  }}
                >
                  <EyeOff /> Скрыть виджет
                </button>
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDashboardSettings();
                  }}
                >
                  <LayoutGrid /> Настроить дашборд
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="widget__body">{children}</div>
    </section>
  );
}
