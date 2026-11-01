import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface ClientTabItem {
  id: string;
  label: string;
  badge?: number;
}

/** Вкладки клиентской страницы: подчёркивание едет, панели листаются свайпом. */
export function ClientPanels({
  tabs,
  value,
  onChange,
  children
}: {
  tabs: ClientTabItem[];
  value: string;
  onChange: (id: string) => void;
  children: ReactNode[];
}) {
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === value));
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'x' | 'y' | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const node = panelRefs.current[index];
      if (node) setHeight(node.getBoundingClientRect().height);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [index, children.length]);

  useEffect(() => {
    const node = panelRefs.current[index];
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(node.getBoundingClientRect().height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [index]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    startX.current = event.touches[0].clientX;
    startY.current = event.touches[0].clientY;
    axis.current = null;
    setDragging(true);
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (!dragging || event.touches.length !== 1) return;
    const dx = event.touches[0].clientX - startX.current;
    const dy = event.touches[0].clientY - startY.current;
    if (!axis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis.current !== 'x') return;
    const edge = (index === 0 && dx > 0) || (index === tabs.length - 1 && dx < 0);
    setDrag(edge ? dx * 0.28 : dx);
  };

  const onTouchEnd = () => {
    if (!dragging) return;
    const threshold = 56;
    if (drag <= -threshold && index < tabs.length - 1) onChange(tabs[index + 1].id);
    else if (drag >= threshold && index > 0) onChange(tabs[index - 1].id);
    setDrag(0);
    setDragging(false);
    axis.current = null;
  };

  return (
    <>
      <div className="cp-tabs" role="tablist">
        <span
          className="cp-tabs__indicator"
          style={{ width: `${100 / tabs.length}%`, transform: `translateX(${index * 100}%)` }}
          aria-hidden
        />
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === value}
            data-active={tab.id === value}
            className="cp-tab"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && <b className="cp-tab__badge">{tab.badge}</b>}
          </button>
        ))}
      </div>

      <div
        className="cp-panels"
        data-dragging={dragging || undefined}
        style={height ? { height } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="cp-panels__track"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`,
            transition: dragging ? 'none' : undefined
          }}
        >
          {children.map((panel, i) => (
            <div
              className="cp-panel"
              key={tabs[i]?.id || i}
              aria-hidden={i !== index}
              ref={(node) => {
                panelRefs.current[i] = node;
              }}
            >
              {panel}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
