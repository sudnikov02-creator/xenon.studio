import { useEffect, useRef } from 'react';
import type { ClipboardEvent, ChangeEvent, KeyboardEvent } from 'react';

const LENGTH = 6;

export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  useEffect(() => {
    const firstEmpty = value.length < LENGTH ? value.length : LENGTH - 1;
    refs.current[firstEmpty]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    return clean;
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      const list = value.split('');
      list[index] = '';
      apply(list.join('').slice(0, index));
      return;
    }
    const list = value.padEnd(LENGTH, ' ').split('');
    const chars = raw.split('');
    let cursor = index;
    for (const char of chars) {
      if (cursor >= LENGTH) break;
      list[cursor] = char;
      cursor += 1;
    }
    const next = apply(list.join('').replace(/\s/g, ''));
    refs.current[Math.min(cursor, LENGTH - 1)]?.focus();
    if (next.length === LENGTH) onComplete?.(next);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index].trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    const next = apply(text);
    refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="code-input" data-invalid={invalid || undefined} role="group" aria-label="Код из шести цифр">
      {Array.from({ length: LENGTH }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className="code-input__cell"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digits[index].trim()}
          disabled={disabled}
          aria-label={`Цифра ${index + 1}`}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.currentTarget.select()}
        />
      ))}
    </div>
  );
}
