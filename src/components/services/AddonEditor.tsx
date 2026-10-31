import { Plus, Trash2 } from 'lucide-react';
import { ADDON_TYPE_LABELS, addonSummary, makeAddon } from '../../lib/services';
import type { ServiceAddon } from '../../types';

export function AddonEditor({
  addons,
  currency,
  onChange
}: {
  addons: ServiceAddon[];
  currency: string;
  onChange: (addons: ServiceAddon[]) => void;
}) {
  const update = (id: string, patch: Partial<ServiceAddon>) => {
    onChange(addons.map((addon) => (addon.id === id ? { ...addon, ...patch } : addon)));
  };

  const remove = (id: string) => onChange(addons.filter((addon) => addon.id !== id));

  return (
    <div className="addons">
      {addons.length === 0 ? (
        <div className="addons__empty">
          Дополнительных опций нет. Клиент увидит только базовую цену услуги.
        </div>
      ) : (
        <div className="addons__list">
          {addons.map((addon) => (
            <div className="addon-row" key={addon.id}>
              <input
                className="input addon-row__name"
                value={addon.name}
                placeholder="Например, визажист"
                maxLength={60}
                aria-label="Название опции"
                onChange={(event) => update(addon.id, { name: event.target.value })}
              />
              <select
                className="select addon-row__type"
                value={addon.type}
                aria-label="Тип опции"
                onChange={(event) => {
                  const type = event.target.value as ServiceAddon['type'];
                  update(addon.id, { type, ...(type === 'quantity' ? { unit: addon.unit || 'шт' } : {}) });
                }}
              >
                <option value="toggle">{ADDON_TYPE_LABELS.toggle}</option>
                <option value="quantity">{ADDON_TYPE_LABELS.quantity}</option>
              </select>
              <div className="addon-row__price">
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={100}
                  value={addon.price}
                  aria-label="Цена опции"
                  onChange={(event) => update(addon.id, { price: Number(event.target.value) })}
                />
                <span className="addon-row__currency">{currency}</span>
              </div>
              {addon.type === 'quantity' ? (
                <input
                  className="input addon-row__unit"
                  value={addon.unit || 'шт'}
                  maxLength={12}
                  aria-label="Единица измерения"
                  onChange={(event) => update(addon.id, { unit: event.target.value })}
                />
              ) : (
                <span className="addon-row__unit-hint">за услугу</span>
              )}
              <button
                type="button"
                className="btn btn--icon addon-row__remove"
                onClick={() => remove(addon.id)}
                aria-label={`Удалить опцию «${addon.name || 'без названия'}»`}
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="addons__foot">
        <button
          type="button"
          className="btn btn--sm btn--soft"
          disabled={addons.length >= 12}
          onClick={() => onChange([...addons, makeAddon(addons.length)])}
        >
          <Plus /> Добавить опцию
        </button>
        <span>
          {addons.length > 0
            ? `Опций: ${addons.length} · ${addonSummary(addons[0], currency)} и далее`
            : 'До 12 опций на услугу'}
        </span>
      </div>
    </div>
  );
}
