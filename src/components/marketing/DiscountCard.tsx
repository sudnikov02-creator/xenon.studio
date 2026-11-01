import { useState } from 'react';
import {
  BadgePercent,
  CalendarClock,
  Copy,
  Crown,
  Gift,
  Pencil,
  Sparkles,
  Ticket,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Switch } from '../ui/Switch';
import { formatMoney, plural } from '../../lib/utils';
import type { DiscountItem } from '../../types';

const AUDIENCE = {
  all: { label: 'Все клиенты', icon: Users },
  vip: { label: 'Только VIP', icon: Crown },
  repeat: { label: 'С повторной съёмкой', icon: Sparkles },
  new: { label: 'Новые клиенты', icon: UserPlus }
} as const;

const STATUS = {
  active: 'действует',
  off: 'выключена',
  scheduled: 'запланирована',
  expired: 'истекла'
} as const;

function period(item: DiscountItem): string {
  if (!item.startsOn && !item.endsOn) return 'без ограничения срока';
  const format = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00.000Z`));
  if (item.startsOn && item.endsOn) return `${format(item.startsOn)} — ${format(item.endsOn)}`;
  if (item.endsOn) return `до ${format(item.endsOn)}`;
  return `с ${format(item.startsOn as string)}`;
}

export function DiscountCard({
  item,
  busy,
  currencySymbol,
  decimalSeparator,
  onToggle,
  onEdit,
  onDelete,
  onCoupons
}: {
  item: DiscountItem;
  busy: boolean;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onToggle: (value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCoupons: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const audience = AUDIENCE[item.audience] || AUDIENCE.all;
  const AudienceIcon = audience.icon;
  const value =
    item.kind === 'percent'
      ? `${item.value}%`
      : formatMoney(item.value, currencySymbol, decimalSeparator);
  const scope =
    item.scope === 'all'
      ? 'Все услуги и пакеты'
      : item.scope === 'service'
        ? `${item.itemIds.length} ${plural(item.itemIds.length, 'услуга', 'услуги', 'услуг')}`
        : `${item.itemIds.length} ${plural(item.itemIds.length, 'пакет', 'пакета', 'пакетов')}`;

  return (
    <>
      <article className="discount-card" data-status={item.status} data-off={!item.isActive || undefined}>
        <header className="discount-card__head">
          <span className="discount-card__mark">
            {item.kind === 'percent' ? <BadgePercent /> : <Gift />}
          </span>
          <div className="discount-card__title">
            <b>{item.name}</b>
            <span data-status={item.status}>{STATUS[item.status]}</span>
          </div>
          <Switch checked={item.isActive} label={`Скидка ${item.name}`} disabled={busy} onChange={onToggle} />
        </header>

        <div className="discount-card__value">
          <strong className="tnum">{value}</strong>
          <span>{item.kind === 'percent' ? 'от стоимости' : 'фиксированная скидка'}</span>
        </div>

        <ul className="discount-card__meta">
          <li>
            <AudienceIcon />
            {audience.label}
          </li>
          <li>
            <Sparkles />
            {scope}
          </li>
          <li>
            <CalendarClock />
            {period(item)}
          </li>
          {item.minAmount > 0 && (
            <li>
              <Ticket />
              от {formatMoney(item.minAmount, currencySymbol, decimalSeparator)}
            </li>
          )}
        </ul>

        {item.note && <p className="discount-card__note">{item.note}</p>}

        <footer className="discount-card__foot">
          <div className="discount-card__stat">
            <em>сэкономлено</em>
            <b className="tnum">{formatMoney(item.applied, currencySymbol, decimalSeparator)}</b>
          </div>
          <div className="discount-card__actions">
            {item.coupons > 0 && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={onCoupons} title="Промокоды со скидкой">
                <Copy /> {item.coupons}
              </button>
            )}
            <button type="button" className="btn btn--sm btn--bordered" onClick={onEdit} disabled={busy}>
              <Pencil /> <span>Изменить</span>
            </button>
            <button
              type="button"
              className="btn btn--icon btn--ghost discount-card__delete"
              onClick={() => setConfirm(true)}
              disabled={busy}
              aria-label={`Удалить скидку ${item.name}`}
            >
              <Trash2 />
            </button>
          </div>
        </footer>
      </article>

      <ConfirmModal
        open={confirm}
        title="Удалить скидку?"
        message={
          <span>
            Скидка «{item.name}» перестанет применяться. Привязанные промокоды останутся, но станут неактивными.
          </span>
        }
        confirmLabel="Удалить скидку"
        icon={<Trash2 />}
        onConfirm={() => {
          setConfirm(false);
          onDelete();
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
