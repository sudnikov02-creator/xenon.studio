import type { CSSProperties } from 'react';
import { ArrowRight, CalendarCheck2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { formatDayTime, formatMoney, formatTimeIn, initials, pluralize } from '../../lib/utils';
import type { BookingSummary } from '../../types';

export function TodayWidget({
  bookings,
  next,
  config
}: {
  bookings: BookingSummary[];
  next: BookingSummary | null;
  config: Record<string, boolean>;
}) {
  const { branding } = useSettings();
  const navigate = useNavigate();
  const showPrice = config.showPrice !== false;
  const showStatus = config.showStatus !== false;

  if (bookings.length === 0) {
    return (
      <div className="widget-empty">
        <span className="widget-empty__icon">
          <CalendarCheck2 />
        </span>
        <b>Сегодня съёмок нет</b>
        <p>
          {next
            ? `Ближайшая съёмка — ${formatDayTime(next.startsAt, branding.timezone)}`
            : 'Свободный день. Новые записи появятся здесь автоматически.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="session-list">
        {bookings.map((booking) => (
          <div className="session-row" key={booking.id}>
            <div className="session-row__time">
              <b className="tnum">{formatTimeIn(booking.startsAt, branding.timezone)}</b>
              <span>{booking.duration} мин</span>
            </div>
            <span className="avatar avatar--soft session-row__avatar" style={{ '--size': '36px' } as CSSProperties}>
              {initials(booking.client?.name || 'К')}
            </span>
            <div className="session-row__info">
              <b className="truncate">{booking.client?.name || 'Клиент'}</b>
              <span className="truncate">{booking.service?.name || booking.package?.name || 'Съёмка'}</span>
            </div>
            <div className="session-row__meta">
              {showPrice && (
                <span className="session-row__price tnum">
                  {formatMoney(booking.price, branding.currencySymbol, branding.decimalSeparator)}
                </span>
              )}
              {showStatus && booking.status && (
                <span className="status-chip" style={{ '--status': booking.status.color } as CSSProperties}>
                  {booking.status.name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="widget__foot">
        <span>{pluralize(bookings.length, 'съёмка', 'съёмки', 'съёмок')} в расписании</span>
        <button type="button" className="widget__link" onClick={() => navigate('/admin/bookings')}>
          Все записи <ArrowRight />
        </button>
      </div>
    </>
  );
}
