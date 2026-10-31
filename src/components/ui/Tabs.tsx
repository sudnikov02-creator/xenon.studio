import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'default' | 'pill';
  className?: string;
}

export function Tabs({ items, value, onChange, variant = 'default', className }: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`[data-tab-id="${value}"]`);
    if (!active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value]);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [measure, items.length]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  return (
    <div ref={listRef} className={cn('tabs', variant === 'pill' && 'tabs--pill', className)} role="tablist">
      {variant === 'default' && (
        <span className="tabs__indicator" style={{ left: indicator.left, width: indicator.width }} aria-hidden />
      )}
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab-id={item.id}
            data-active={active}
            aria-selected={active}
            className="tab"
            onClick={() => onChange(item.id)}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              {Icon && <Icon style={{ width: 15, height: 15 }} />}
              {item.label}
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="counter counter--muted" style={{ height: 18, minWidth: 18, fontSize: 11 }}>
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
