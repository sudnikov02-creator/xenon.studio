import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'narrow' | 'medium' | 'default' | 'wide' | 'full';
  className?: string;
  hideClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'narrow',
  className,
  hideClose
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  const requestClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    restoreFocus.current = document.activeElement as HTMLElement;
    const focusTimer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
      if (event.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (node) => node.offsetParent !== null
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      restoreFocus.current?.focus?.();
    };
  }, [mounted, requestClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="overlay-backdrop"
      data-closing={closing || undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn('overlay', size !== 'default' && `overlay--${size}`, className)}
        data-closing={closing || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {(title || !hideClose) && (
          <div className="overlay__head">
            {icon && (
              <div className="empty__icon" style={{ width: 38, height: 38, borderRadius: 11, marginBottom: 0 }}>
                {icon}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && <div className="overlay__title">{title}</div>}
              {subtitle && <div className="overlay__sub">{subtitle}</div>}
            </div>
            {!hideClose && (
              <button type="button" className="btn btn--icon" onClick={requestClose} aria-label="Закрыть">
                <X />
              </button>
            )}
          </div>
        )}
        <div className="overlay__body">{children}</div>
        {footer && <div className="overlay__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
