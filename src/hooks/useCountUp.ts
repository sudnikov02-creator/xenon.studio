import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);
  const previous = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = previous.current;
    previous.current = target;

    if (reduce || duration <= 0) {
      setValue(target);
      return;
    }
    if (frame.current) cancelAnimationFrame(frame.current);
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}
