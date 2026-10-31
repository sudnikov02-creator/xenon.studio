import type { CSSProperties } from 'react';
import { ArrowRight, CalendarCheck2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDayTime, formatMoney, formatTimeIn, initials } from '../../lib/utils';
import type { BookingSummary } from '../../types';

export function TodayWidget({
  bookings,
  next,
  timezone,
  currencySymbol,
  decimalSeparator,
  showPrice,
  showStatus
}: {
  bookings: BookingSummary[];
  next: BookingSummary | null;
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  showPrice: boolean;
  showStatus: boolean;
}) {
  const navigate = useNavigate();

  if (bookings.length === 0) {
    return (
      <div className="widget-empty">
        <span className="widget-empty__icon">
          <CalendarCheck2 />
        </span>
        <b>Сегодня съёмок нет</b>
        <p>
          {next
            ? `Ближайшая запись — ${formatDayTime(next.startsAt, timezone)}.`
            : 'Свободный день. Новые заявки появятся здесь автоматически.'}
        </p>
        <button type="button" className="widget-empty__link" onClick={() => navigate('/admin/bookings')}>
          Все записи <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="session-list">
        {bookings.map((booking) => (
          <div className="session-row" key={booking.id}>
            <div className="session-row__time">
              <b className="tnum">{formatTimeIn(booking.startsAt, timezone)}</b>
              <span>{booking.duration} мин</span>
            </div>
            <span className="avatar avatar--soft session-row__avatar" aria-hidden>
              {initials(booking.client?.name || 'Клиент')}
            </span>
            <div className="session-row__info">
              <b>{booking.client?.name || 'Клиент'}</b>
              <span>{booking.service?.name || booking.package?.name || 'Съёмка'}</span>
            </div>
            <div className="session-row__meta">
              {showStatus && booking.status && (
                <span className="status-chip" style={{ '--status': booking.status.color } as CSSProperties}>
                  {booking.status.name}
                </span>
              )}
              {showPrice && (
                <span className="session-row__price tnum">
                  {formatMoney(booking.price, currencySymbol, decimalSeparator)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="widget__foot">
        <span>Ближайшая — {next ? formatDayTime(next.startsAt, timezone) : 'не запланирована'}</span>
        <button type="button" className="widget__link" onClick={() => navigate('/admin/bookings')}>
          Все записи <ArrowRight />
        </button>
      </div>
    </>
  );
}
