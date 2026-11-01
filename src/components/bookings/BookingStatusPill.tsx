import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import type { BookingStatusInfo, BookingStatus } from '../../types';

export function BookingStatusPill({
  status,
  size = 'md',
  className
}: {
  status: BookingStatus | BookingStatusInfo | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (!status) return null;
  return (
    <span
      className={cn('bstatus', size === 'sm' && 'bstatus--sm', className)}
      style={{ '--status': status.color } as CSSProperties}
      title={status.name}
    >
      <i aria-hidden />
      {status.name}
    </span>
  );
}
