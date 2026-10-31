import { CalendarClock, Clock3, Layers, Sparkles } from 'lucide-react';
import { formatDuration, formatPrice } from '../../lib/services';
import { formatLongDate, relativeDayLabel } from '../../lib/booking';
import type { BookingDraft, BookingFormOptions } from '../../types';

export function BookingSummary({
  options,
  draft,
  item,
  totals,
  compact = false
}: {
  options: BookingFormOptions | null;
  draft: BookingDraft;
  item: { kind: 'service' | 'package'; name: string; duration: number; price: number } | null;
  totals: { base: number; extras: number; total: number; lines: { addon: { id: string; name: string }; total: number; qty: number }[] };
  compact?: boolean;
}) {
  const currency = options?.branding.currencySymbol || '₽';
  const today = options?.today || '';
  const dateLabel = draft.date
    ? `${relativeDayLabel(draft.date, today) ? `${relativeDayLabel(draft.date, today)}, ` : ''}${formatLongDate(draft.date)}`
    : 'Дата не выбрана';

  return (
    <div className={`bk-sum${compact ? ' bk-sum--compact' : ''}`}>
      <div className="bk-sum__head">
        <span className="bk-sum__caption">Ваша запись</span>
        <span className="bk-sum__total tnum">{formatPrice(totals.total, currency)}</span>
      </div>

      <div className="bk-sum__rows">
        <div className="bk-sum__row">
          <span className="bk-sum__icon">
            <Layers />
          </span>
          <div>
            <b>{item ? item.name : 'Услуга не выбрана'}</b>
            <em>{item ? `${item.kind === 'package' ? 'Пакет' : 'Услуга'} · ${formatDuration(item.duration)}` : 'Шаг 1'}</em>
          </div>
        </div>

        <div className="bk-sum__row">
          <span className="bk-sum__icon">
            <CalendarClock />
          </span>
          <div>
            <b>{dateLabel}</b>
            <em>{draft.time ? `Начало в ${draft.time}` : 'Время не выбрано'}</em>
          </div>
        </div>

        {totals.lines.length > 0 && (
          <div className="bk-sum__row bk-sum__row--lines">
            <span className="bk-sum__icon">
              <Sparkles />
            </span>
            <div>
              {totals.lines.map((line) => (
                <b key={line.addon.id} className="bk-sum__line">
                  {line.addon.name}
                  {line.qty > 1 ? ` × ${line.qty}` : ''}
                  <span className="tnum">+{formatPrice(line.total, currency)}</span>
                </b>
              ))}
            </div>
          </div>
        )}

        {draft.date && draft.time && item && (
          <div className="bk-sum__row bk-sum__row--muted">
            <span className="bk-sum__icon">
              <Clock3 />
            </span>
            <div>
              <em>
                Длительность {formatDuration(item.duration)} · резерв на дорогу и подготовку включён
              </em>
            </div>
          </div>
        )}
      </div>

      <div className="bk-sum__foot">
        <div>
          <span>Стоимость съёмки</span>
          <b className="tnum">{formatPrice(totals.base, currency)}</b>
        </div>
        {totals.extras > 0 && (
          <div>
            <span>Дополнения</span>
            <b className="tnum">+{formatPrice(totals.extras, currency)}</b>
          </div>
        )}
        <div className="bk-sum__grand">
          <span>Итого</span>
          <b className="tnum">{formatPrice(totals.total, currency)}</b>
        </div>
      </div>
    </div>
  );
}
