import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetId } from '../types';

export interface WidgetDragState {
  id: WidgetId;
  x: number;
  y: number;
  dx: number;
  dy: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export function useWidgetDrag({
  visibleIds,
  onReorder
}: {
  visibleIds: WidgetId[];
  onReorder: (id: WidgetId, index: number) => void;
}) {
  const [drag, setDrag] = useState<WidgetDragState | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  const dragRef = useRef<WidgetDragState | null>(null);
  const placeholderRef = useRef<number | null>(null);
  const idsRef = useRef<WidgetId[]>(visibleIds);
  const onReorderRef = useRef(onReorder);
  const active = drag !== null;

  idsRef.current = visibleIds;
  onReorderRef.current = onReorder;

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, id: WidgetId, element: HTMLElement) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const state: WidgetDragState = {
        id,
        x: event.clientX,
        y: event.clientY,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
      dragRef.current = state;
      setDrag(state);
      placeholderRef.current = null;
      setPlaceholderIndex(null);
    },
    [visibleIds]
  );

  const stop = useCallback(() => {
    dragRef.current = null;
    placeholderRef.current = null;
    setDrag(null);
    setPlaceholderIndex(null);
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleMove = (event: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (!state.moved && distance < 4) return;
      if (event.cancelable) event.preventDefault();
      if (!state.moved) {
        const startIndex = Math.max(0, idsRef.current.indexOf(state.id));
        placeholderRef.current = startIndex;
        setPlaceholderIndex(startIndex);
      }
      setDrag({ ...state, x: event.clientX, y: event.clientY, moved: true });

      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-widget-frame]'));
      let index = nodes.length;
      for (let i = 0; i < nodes.length; i++) {
        const rect = nodes[i].getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      placeholderRef.current = index;
      setPlaceholderIndex(index);
    };

    const handleUp = () => {
      const state = dragRef.current;
      const index = placeholderRef.current;
      if (state && index !== null) {
        onReorderRef.current(state.id, index);
      }
      stop();
    };

    const handleCancel = () => stop();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };

    document.body.classList.add('is-widget-dragging');
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.classList.remove('is-widget-dragging');
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('keydown', handleKey);
    };
  }, [active, stop]);

  return { drag, placeholderIndex, startDrag, cancelDrag: stop };
}
