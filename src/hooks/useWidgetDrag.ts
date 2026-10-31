import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetId } from '../types';

export interface WidgetDragState {
  id: WidgetId;
  width: number;
  height: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function useWidgetDrag({
  visibleIds,
  onCommit
}: {
  visibleIds: WidgetId[];
  onCommit: (order: WidgetId[]) => void;
}) {
  const [drag, setDrag] = useState<WidgetDragState | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  const stateRef = useRef<WidgetDragState | null>(null);
  const placeholderRef = useRef<number | null>(null);
  const visibleRef = useRef<WidgetId[]>(visibleIds);
  const commitRef = useRef(onCommit);
  const dragging = Boolean(drag);

  visibleRef.current = visibleIds;
  commitRef.current = onCommit;

  const stop = useCallback(() => {
    stateRef.current = null;
    placeholderRef.current = null;
    setDrag(null);
    setPlaceholderIndex(null);
    document.body.classList.remove('is-widget-dragging');
  }, []);

  const start = useCallback((event: ReactPointerEvent<HTMLButtonElement>, id: WidgetId, element: HTMLElement) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const state: WidgetDragState = {
      id,
      width: rect.width,
      height: rect.height,
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top
    };
    stateRef.current = state;
    placeholderRef.current = visibleRef.current.indexOf(id);
    setPlaceholderIndex(placeholderRef.current);
    setDrag(state);
    document.body.classList.add('is-widget-dragging');
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if (event.cancelable) event.preventDefault();
      setDrag((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));

      const frames = Array.from(document.querySelectorAll<HTMLElement>('[data-widget-frame]'));
      let index = frames.length;
      for (let i = 0; i < frames.length; i += 1) {
        const rect = frames[i].getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          index = i;
          break;
        }
      }
      placeholderRef.current = index;
      setPlaceholderIndex(index);
    };

    const onUp = () => {
      const state = stateRef.current;
      const target = placeholderRef.current;
      if (state) {
        const rest = visibleRef.current.filter((id) => id !== state.id);
        const clamped = Math.max(0, Math.min(target ?? rest.length, rest.length));
        rest.splice(clamped, 0, state.id);
        if (rest.join('|') !== visibleRef.current.join('|')) commitRef.current(rest);
      }
      stop();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragging, stop]);

  return { drag, placeholderIndex, start, stop };
}
