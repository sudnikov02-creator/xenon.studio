import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  title: string;
  subtitle?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  duration?: number;
}

interface ToastRecord extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const [leaving, setLeaving] = useState<number[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setLeaving((prev) => (prev.includes(id) ? prev : [...prev, id]));
    const timer = setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLeaving((prev) => prev.filter((item) => item !== id));
      const stored = timers.current.get(id);
      if (stored) clearTimeout(stored);
      timers.current.delete(id);
    }, 300);
    timers.current.set(id, timer);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++seq;
      const duration = input.duration ?? 4000;
      setItems((prev) => [...prev.slice(-3), { ...input, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toaster" role="region" aria-live="polite" aria-label="Уведомления">
          {items.map((item) => (
            <ToastCard
              key={item.id}
              item={item}
              leaving={leaving.includes(item.id)}
              onDismiss={() => dismiss(item.id)}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  leaving,
  onDismiss
}: {
  item: ToastRecord;
  leaving: boolean;
  onDismiss: () => void;
}) {
  const variant = item.variant || 'default';
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : variant === 'info' ? Info : Info;

  return (
    <div className="toast" data-variant={variant} data-leaving={leaving || undefined} role="status">
      <div className="toast__icon">
        <Icon />
      </div>
      <div className="toast__content">
        <div className="toast__title">{item.title}</div>
        {item.subtitle && <div className="toast__sub">{item.subtitle}</div>}
      </div>
      {item.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            item.action?.onClick();
            onDismiss();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Закрыть уведомление">
        <X />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
