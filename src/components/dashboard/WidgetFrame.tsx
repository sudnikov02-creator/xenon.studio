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
import { useDismissable } from '../../hooks/useDismissable';
import type { WidgetId } from '../../types';

export function WidgetFrame({
  id,
  title,
  subtitle,
  icon: Icon,
  count,
  children,
  configurable,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onHide,
  onConfigure,
  onConfigureDashboard,
  onDragStart,
  className
}: {
  id: WidgetId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  count?: number;
  children: ReactNode;
  configurable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  onConfigure: () => void;
  onConfigureDashboard: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, element: HTMLElement) => void;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismissable<HTMLDivElement>(menuOpen, closeMenu);
  const sectionRef = useRef<HTMLElement | null>(null);

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  return (
    <section
      ref={sectionRef}
      className={`widget card ${className || ''}`.trim()}
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
          <p className="widget__sub">{subtitle}</p>
        </div>
        {typeof count === 'number' && count > 0 && <span className="counter counter--muted widget__count">{count}</span>}
        <div className="widget__actions">
          <button
            type="button"
            className="widget__handle"
            aria-label={`Перетащить виджет «${title}»`}
            title="Перетащить"
            onPointerDown={(event) => {
              if (sectionRef.current) onDragStart(event, sectionRef.current);
            }}
          >
            <GripVertical />
          </button>
          <div className="widget__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="widget__menu-btn"
              aria-label={`Меню виджета «${title}»`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <MoreHorizontal />
            </button>
            {menuOpen && (
              <div className="widget-menu" role="menu">
                {configurable && (
                  <button type="button" className="widget-menu__item" role="menuitem" onClick={run(onConfigure)}>
                    <SlidersHorizontal /> Настроить виджет
                  </button>
                )}
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  disabled={!canMoveUp}
                  onClick={run(onMoveUp)}
                >
                  <ChevronUp /> Переместить выше
                </button>
                <button
                  type="button"
                  className="widget-menu__item"
                  role="menuitem"
                  disabled={!canMoveDown}
                  onClick={run(onMoveDown)}
                >
                  <ChevronDown /> Переместить ниже
                </button>
                <div className="widget-menu__divider" />
                <button type="button" className="widget-menu__item" role="menuitem" onClick={run(onHide)}>
                  <EyeOff /> Скрыть виджет
                </button>
                <button type="button" className="widget-menu__item" role="menuitem" onClick={run(onConfigureDashboard)}>
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
