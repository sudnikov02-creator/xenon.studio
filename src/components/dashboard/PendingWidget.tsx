import type { CSSProperties } from 'react';
import { Check, CheckCircle2, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { formatDayTime, formatMoney, initials } from '../../lib/utils';
import type { BookingSummary } from '../../types';

export function PendingWidget({
  items,
  config,
  busyId,
  onAccept,
  onDecline
}: {
  items: BookingSummary[];
  config: Record<string, boolean>;
  busyId: number | null;
  onAccept: (booking: BookingSummary) => void;
  onDecline: (booking: BookingSummary) => void;
}) {
  const { branding } = useSettings();
  const showPrice = config.showPrice !== false;

  if (items.length === 0) {
    return (
      <div className="widget-empty">
        <span className="widget-empty__icon widget-empty__icon--success">
          <CheckCircle2 />
        </span>
        <b>Все заявки обработаны</b>
        <p>Новые заявки появятся здесь автоматически — страницу обновлять не нужно.</p>
      </div>
    );
  }

  return (
    <div className="pending-list">
      {items.map((booking) => {
        const busy = busyId === booking.id;
        const clientName = booking.client?.name || 'Клиент';
        return (
          <article className="pending-row" key={booking.id} data-busy={busy || undefined}>
            <span className="avatar avatar--soft pending-row__avatar" style={{ '--size': '36px' } as CSSProperties}>
              {initials(clientName)}
            </span>
            <div className="pending-row__info">
              <div className="pending-row__name">
                <b className="truncate">{clientName}</b>
                {showPrice && (
                  <span className="pending-row__price tnum">
                    {formatMoney(booking.price, branding.currencySymbol, branding.decimalSeparator)}
                  </span>
                )}
              </div>
              <span className="pending-row__sub truncate">
                {booking.service?.name || booking.package?.name || 'Съёмка'} ·{' '}
                {formatDayTime(booking.startsAt, branding.timezone)}
              </span>
            </div>
            <div className="pending-row__actions">
              <button
                type="button"
                className={`btn btn--sm btn--accept${busy ? ' btn--loading' : ''}`}
                disabled={busy}
                onClick={() => onAccept(booking)}
                aria-label={`Принять заявку: ${clientName}`}
              >
                <Check /> Принять
              </button>
              <button
                type="button"
                className="btn btn--sm btn--icon btn--bordered btn--decline"
                disabled={busy}
                onClick={() => onDecline(booking)}
                aria-label={`Отклонить заявку: ${clientName}`}
                title="Отклонить"
                style={{ color: 'var(--muted)' }}
              >
                <X />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
