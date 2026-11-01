import { useState } from 'react';
import { BadgePercent, CalendarClock, Check, Clock3, Coins, Gift, Layers, Sparkles, Tag, X } from 'lucide-react';
import { formatDuration, formatPrice } from '../../lib/services';
import { formatLongDate, relativeDayLabel } from '../../lib/booking';
import type { BookingDraft, BookingFormOptions, PriceQuote } from '../../types';

export function BookingSummary({
  options,
  draft,
  item,
  totals,
  quote = null,
  promoInput = '',
  promoCode = '',
  promoError = null,
  promoBusy = false,
  onPromoInput,
  onApplyPromo,
  onClearPromo,
  showPromo = false,
  showBonus = false,
  useBonus = false,
  onToggleBonus,
  compact = false
}: {
  options: BookingFormOptions | null;
  draft: BookingDraft;
  item: { kind: 'service' | 'package'; name: string; duration: number; price: number } | null;
  totals: { base: number; extras: number; total: number; lines: { addon: { id: string; name: string }; total: number; qty: number }[] };
  quote?: PriceQuote | null;
  promoInput?: string;
  promoCode?: string;
  promoError?: string | null;
  promoBusy?: boolean;
  onPromoInput?: (value: string) => void;
  onApplyPromo?: () => void;
  onClearPromo?: () => void;
  showPromo?: boolean;
  showBonus?: boolean;
  useBonus?: boolean;
  onToggleBonus?: (value: boolean) => void;
  compact?: boolean;
}) {
  const currency = options?.branding.currencySymbol || '₽';
  const today = options?.today || '';
  const [promoOpen, setPromoOpen] = useState(Boolean(promoCode));
  const payable = quote ? quote.total : totals.total;
  const autoDiscount = quote?.discount || null;
  const promo = quote?.promo || null;
  const bonus = quote?.bonus || null;
  const bonusApplied = useBonus && bonus ? bonus.applied : 0;
  const savings = quote ? Math.max(quote.subtotal - quote.total, 0) : 0;
  const promoVisible = showPromo || Boolean(onApplyPromo);
  const dateLabel = draft.date
    ? `${relativeDayLabel(draft.date, today) ? `${relativeDayLabel(draft.date, today)}, ` : ''}${formatLongDate(draft.date)}`
    : 'Дата не выбрана';

  return (
    <div className={`bk-sum${compact ? ' bk-sum--compact' : ''}`}>
      <div className="bk-sum__head">
        <span className="bk-sum__caption">Ваша запись</span>
        <span className="bk-sum__total tnum" data-sale={savings > 0 || undefined}>
          {savings > 0 && <s>{formatPrice(totals.total, currency)}</s>}
          {formatPrice(payable, currency)}
        </span>
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
        {autoDiscount && autoDiscount.amount > 0 && (
          <div className="bk-sum__saving" data-reveal>
            <span>
              <BadgePercent /> {autoDiscount.name}
            </span>
            <b className="tnum">−{formatPrice(autoDiscount.amount, currency)}</b>
          </div>
        )}

        {promo && (
          <div className="bk-sum__saving bk-sum__saving--promo" data-reveal>
            <span>
              {promo.type === 'certificate' ? <Gift /> : <Tag />} {promo.code || promo.label}
            </span>
            <b className="tnum">−{formatPrice(promo.amount, currency)}</b>
          </div>
        )}

        {bonusApplied > 0 && (
          <div className="bk-sum__saving bk-sum__saving--bonus" data-reveal>
            <span>
              <Coins /> Оплата баллами
            </span>
            <b className="tnum">−{formatPrice(bonusApplied, currency)}</b>
          </div>
        )}

        {promoVisible && !compact && item && (
          <div className="bk-sum__promo">
            {promo ? (
              <div className="bk-promo-applied">
                <Check />
                <span>{promo.label || 'Скидка применена'}</span>
                {onClearPromo && (
                  <button type="button" onClick={onClearPromo} aria-label="Убрать промокод">
                    <X />
                  </button>
                )}
              </div>
            ) : promoOpen ? (
              <div className="bk-promo">
                <span className="input-wrap">
                  <Tag aria-hidden />
                  <input
                    className="input"
                    value={promoInput}
                    placeholder="Промокод или сертификат"
                    aria-label="Промокод или сертификат"
                    onChange={(event) => onPromoInput?.(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onApplyPromo?.();
                      }
                    }}
                  />
                </span>
                <button
                  type="button"
                  className={`btn btn--sm${promoBusy ? ' btn--loading' : ''}`}
                  onClick={onApplyPromo}
                  disabled={!promoInput.trim() || promoBusy}
                >
                  Применить
                </button>
              </div>
            ) : (
              <button type="button" className="bk-promo__toggle" onClick={() => setPromoOpen(true)}>
                <Tag /> У меня есть промокод или сертификат
              </button>
            )}
            {promoError && <span className="bk-promo__error">{promoError}</span>}
          </div>
        )}

        {showBonus && bonus && bonus.available > 0 && !compact && (
          <div className="bk-bonus">
            <div className="bk-bonus__info">
              <Coins />
              <span>
                <b>{bonus.available}</b> баллов на счёте
                {bonus.limit > 0 && <em>можно списать до {formatPrice(bonus.limit, currency)}</em>}
              </span>
            </div>
            <label className="bk-bonus__toggle">
              <input
                type="checkbox"
                checked={useBonus}
                onChange={(event) => onToggleBonus?.(event.target.checked)}
              />
              <span>Оплатить баллами</span>
            </label>
          </div>
        )}

        <div className="bk-sum__grand">
          <span>Итого{savings > 0 ? ' · со скидкой' : ''}</span>
          <b className="tnum">{formatPrice(payable, currency)}</b>
        </div>
      </div>
    </div>
  );
}
