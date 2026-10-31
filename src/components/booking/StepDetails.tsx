import { Minus, Plus, Sparkles } from 'lucide-react';
import { formatPrice } from '../../lib/services';
import type { BookingDraft, BookingFormOptions, ServiceAddon } from '../../types';

function AddonRow({
  addon,
  qty,
  currency,
  onChange
}: {
  addon: ServiceAddon;
  qty: number;
  currency: string;
  onChange: (qty: number) => void;
}) {
  const active = qty > 0;
  return (
    <div className="bk-addon" data-active={active || undefined}>
      <div className="bk-addon__text">
        <b>{addon.name}</b>
        <span>
          {addon.type === 'quantity'
            ? `${formatPrice(addon.price, currency)} за ${addon.unit || 'шт'}`
            : `+${formatPrice(addon.price, currency)}`}
        </span>
      </div>

      {addon.type === 'quantity' ? (
        <div className="bk-qty">
          <button
            type="button"
            className="bk-qty__btn"
            onClick={() => onChange(Math.max(0, qty - 1))}
            disabled={qty === 0}
            aria-label={`Убрать ${addon.name}`}
          >
            <Minus />
          </button>
          <span className="bk-qty__value tnum" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className="bk-qty__btn"
            onClick={() => onChange(Math.min(20, qty + 1))}
            aria-label={`Добавить ${addon.name}`}
          >
            <Plus />
          </button>
        </div>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={addon.name}
          className="switch"
          data-on={active}
          onClick={() => onChange(active ? 0 : 1)}
        />
      )}
    </div>
  );
}

export function StepDetails({
  options,
  draft,
  item,
  total,
  onChange
}: {
  options: BookingFormOptions;
  draft: BookingDraft;
  item: { name: string; addons: ServiceAddon[] } | null;
  total: number;
  onChange: (patch: Partial<BookingDraft>) => void;
}) {
  const currency = options.branding.currencySymbol;
  const addons = item?.addons || [];
  const hasAddons = addons.length > 0;

  return (
    <div className="bk-step-inner">
      <header className="bk-step-head">
        <h2>Дополнения и пожелания</h2>
        <p>Всё необязательно — можно оставить только базовую съёмку.</p>
      </header>

      {hasAddons ? (
        <div className="bk-addons">
          {addons.map((addon) => (
            <AddonRow
              key={addon.id}
              addon={addon}
              qty={draft.addons[addon.id] || 0}
              currency={currency}
              onChange={(qty) => onChange({ addons: { ...draft.addons, [addon.id]: qty } })}
            />
          ))}
          <div className="bk-addons__total">
            <span>
              <Sparkles /> Итого с дополнениями
            </span>
            <b className="tnum">{formatPrice(total, currency)}</b>
          </div>
        </div>
      ) : (
        <div className="bk-note">
          У этой съёмки нет дополнительных опций — стоимость фиксированная.
        </div>
      )}

      {options.form.askNote && (
        <label className="field bk-note-field">
          <span className="field__label">Пожелания к съёмке</span>
          <textarea
            className="textarea"
            rows={4}
            maxLength={600}
            placeholder="Например: хочу мягкий свет и кадры в движении, съёмка для семейного архива"
            value={draft.note}
            onChange={(event) => onChange({ note: event.target.value })}
          />
          <span className="field__hint">
            {draft.note.length}/600 · это увидит только фотограф
          </span>
        </label>
      )}
    </div>
  );
}
