import { Ban, ChevronRight, Phone, Sparkles, Star } from 'lucide-react';
import { formatMoney, initials, plural } from '../../lib/utils';
import type { ClientItem } from '../../types';

function relativeDay(dateKey: string | null, today: string): string {
  if (!dateKey) return '—';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const label = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(date)
    .replace('.', '');
  if (dateKey === today) return 'сегодня';
  return label;
}

export function ClientRow({
  client,
  today,
  currencySymbol,
  decimalSeparator,
  onOpen
}: {
  client: ClientItem;
  today: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onOpen: (client: ClientItem) => void;
}) {
  const nextIn = client.nextVisitDate;
  return (
    <button
      type="button"
      className="crow"
      data-vip={client.isVip || undefined}
      data-blocked={client.isBlacklisted || undefined}
      onClick={() => onOpen(client)}
      aria-label={`Клиент ${client.name}`}
    >
      <span className="crow__avatar avatar avatar--soft" aria-hidden>
        {initials(client.name)}
        {client.isVip && (
          <i className="crow__vip" aria-hidden>
            <Star />
          </i>
        )}
      </span>

      <span className="crow__main">
        <b>
          {client.name}
          {client.isBlacklisted && (
            <em className="crow__blocked">
              <Ban /> в чёрном списке
            </em>
          )}
        </b>
        <span className="crow__contacts">
          {client.phone && (
            <span>
              <Phone /> {client.phone}
            </span>
          )}
          {client.email && <span className="crow__email">{client.email}</span>}
        </span>
      </span>

      <span className="crow__visits">
        <b className="tnum">{client.bookings}</b>
        <em>{plural(client.bookings, 'съёмка', 'съёмки', 'съёмок')}</em>
      </span>

      <span className="crow__when">
        {client.bookings === 0 ? (
          <>
            <b>—</b>
            <em>нет визитов</em>
          </>
        ) : nextIn ? (
          <>
            <b>{relativeDay(nextIn, today)}</b>
            <em>впереди</em>
          </>
        ) : (
          <>
            <b>{relativeDay(client.lastVisitDate, today)}</b>
            <em>последняя</em>
          </>
        )}
      </span>

      <span className="crow__spent tnum">{formatMoney(client.spent, currencySymbol, decimalSeparator)}</span>

      <span className="crow__go" aria-hidden>
        {client.segment === 'vip' && <Sparkles className="crow__spark" />}
        <ChevronRight />
      </span>
    </button>
  );
}
