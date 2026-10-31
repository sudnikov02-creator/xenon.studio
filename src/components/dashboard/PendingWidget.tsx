import { ArrowRight, Check, Clock3, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDayTime, formatMoney, initials } from '../../lib/utils';
import type { BookingSummary } from '../../types';

export function PendingWidget({
  items,
  timezone,
  currencySymbol,
  decimalSeparator,
  showPrice,
  busyId,
  onAccept,
  onDecline
}: {
  items: BookingSummary[];
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  showPrice: boolean;
  busyId: number | null;
  onAccept: (booking: BookingSummary) => void;
  onDecline: (booking: BookingSummary) => void;
}) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="widget-empty">
        <span className="widget-empty__icon widget-empty__icon--success">
          <Check />
        </span>
        <b>Все заявки обработаны</b>
        <p>Новые заявки появятся здесь и придут уведомлением — подтверждать можно в один клик.</p>
        <button type="button" className="widget-empty__link" onClick={() => navigate('/admin/bookings')}>
          Открыть записи <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pending-list">
        {items.map((booking) => {
          const busy = busyId === booking.id;
          return (
            <article className="pending-row" key={booking.id} data-busy={busy}>
              <span className="avatar avatar--soft pending-row__avatar" aria-hidden>
                {initials(booking.client?.name || 'Клиент')}
              </span>
              <div className="pending-row__info">
                <div className="pending-row__name">
                  <b>{booking.client?.name || 'Клиент'}</b>
                  {showPrice && (
                    <span className="pending-row__price tnum">
                      {formatMoney(booking.price, currencySymbol, decimalSeparator)}
                    </span>
                  )}
                </div>
                <span className="pending-row__sub">
                  {booking.service?.name || booking.package?.name || 'Съёмка'} ·{' '}
                  {formatDayTime(booking.startsAt, timezone)}
                </span>
              </div>
              <div className="pending-row__actions">
                <button
                  type="button"
                  className={`btn btn--sm btn--accept${busy ? ' btn--loading' : ''}`}
                  disabled={busy}
                  onClick={() => onAccept(booking)}
                  aria-label={`Подтвердить заявку ${booking.client?.name || ''}`}
                  title="Подтвердить"
                >
                  <Check />
                  <span className="btn__label">Подтвердить</span>
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--icon btn--bordered pending-row__decline btn--decline"
                  disabled={busy}
                  onClick={() => onDecline(booking)}
                  aria-label={`Отклонить заявку ${booking.client?.name || ''}`}
                  title="Отклонить"
                >
                  <X />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="widget__foot">
        <span>
          <Clock3 /> Заявки ждут решения
        </span>
        <button type="button" className="widget__link" onClick={() => navigate('/admin/bookings')}>
          Все записи <ArrowRight />
        </button>
      </div>
    </>
  );
}
