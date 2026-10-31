import { cn } from '../../lib/utils';

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md'
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn('switch', size === 'sm' && 'switch--sm')}
      data-on={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    />
  );
}
