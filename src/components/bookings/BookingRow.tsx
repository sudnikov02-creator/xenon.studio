import { ChevronRight, Clock3, Phone } from 'lucide-react';
import { BookingStatusPill } from './BookingStatusPill';
import { formatMoney, formatTimeIn, initials, formatDayLabel } from '../../lib/utils';
import type { BookingSummary } from '../../types';

export function BookingRow({
  booking,
  timezone,
  currencySymbol,
  decimalSeparator,
  today,
  onOpen
}: {
  booking: BookingSummary;
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  today: string;
  onOpen: (booking: BookingSummary) => void;
}) {
  const isToday = booking.localDate === today;
  const isPast = booking.localDate < today;

  return (
    <button
      type="button"
      className="brow"
      data-today={isToday || undefined}
      data-past={isPast || undefined}
      data-cancelled={booking.status?.isCancelled || undefined}
      onClick={() => onOpen(booking)}
      aria-label={`Запись ${booking.client?.name || 'клиент'}, ${formatDayLabel(booking.startsAt, timezone)}`}
    >
      <span className="brow__date">
        <b className="tnum">{formatTimeIn(booking.startsAt, timezone)}</b>
        <em>{formatDayLabel(booking.startsAt, timezone)}</em>
      </span>

      <span className="brow__avatar avatar avatar--soft" aria-hidden>
        {initials(booking.client?.name || 'Клиент')}
      </span>

      <span className="brow__main">
        <b>{booking.client?.name || 'Клиент'}</b>
        <span className="brow__service">
          {booking.service?.name || booking.package?.name || 'Съёмка'}
          {booking.duration ? ` · ${booking.duration} мин` : ''}
        </span>
        {booking.client?.phone && (
          <span className="brow__phone">
            <Phone /> {booking.client.phone}
          </span>
        )}
      </span>

      <span className="brow__status">
        <BookingStatusPill status={booking.status} size="sm" />
      </span>

      <span className="brow__price tnum">{formatMoney(booking.price, currencySymbol, decimalSeparator)}</span>

      <span className="brow__go" aria-hidden>
        {isToday && <Clock3 className="brow__today" />}
        <ChevronRight />
      </span>
    </button>
  );
}
