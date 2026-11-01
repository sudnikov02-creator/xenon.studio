import { useEffect, useState } from 'react';
import { AlertCircle, BadgePercent, Gift, Percent, CircleDollarSign } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { api } from '../../lib/api';
import type { DiscountAudience, DiscountItem, Service, ServicePackage } from '../../types';

interface Draft {
  name: string;
  kind: 'percent' | 'fixed';
  value: string;
  scope: 'all' | 'service' | 'package';
  itemIds: number[];
  minAmount: string;
  audience: DiscountAudience;
  auto: boolean;
  priority: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  note: string;
}

const EMPTY: Draft = {
  name: '',
  kind: 'percent',
  value: '10',
  scope: 'all',
  itemIds: [],
  minAmount: '0',
  audience: 'all',
  auto: true,
  priority: '0',
  startsOn: '',
  endsOn: '',
  isActive: true,
  note: ''
};

const AUDIENCES: { id: DiscountAudience; label: string; hint: string }[] = [
  { id: 'all', label: 'Все клиенты', hint: 'скидка доступна каждому' },
  { id: 'new', label: 'Новые', hint: 'ещё не было завершённых съёмок' },
  { id: 'repeat', label: 'С историей', hint: 'уже была хотя бы одна съёмка' },
  { id: 'vip', label: 'VIP', hint: 'только отмеченные VIP' }
];

export function DiscountModal({
  open,
  discount,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  discount: DiscountItem | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ services: Service[]; packages: ServicePackage[] }>('/services')
      .then((data) => {
        setServices(data.services.filter((item) => item.isActive));
        setPackages(data.packages.filter((item) => item.isActive));
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDraft(
      discount
        ? {
            name: discount.name,
            kind: discount.kind,
            value: String(discount.value),
            scope: discount.scope,
            itemIds: discount.itemIds,
            minAmount: String(discount.minAmount),
            audience: discount.audience,
            auto: discount.auto,
            priority: String(discount.priority),
            startsOn: discount.startsOn || '',
            endsOn: discount.endsOn || '',
            isActive: discount.isActive,
            note: discount.note || ''
          }
        : EMPTY
    );
  }, [open, discount]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const items = draft.scope === 'service' ? services : draft.scope === 'package' ? packages : [];

  const toggleItem = (id: number) => {
    set(
      'itemIds',
      draft.itemIds.includes(id) ? draft.itemIds.filter((value) => value !== id) : [...draft.itemIds, id]
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={discount ? 'Настройка скидки' : 'Новая скидка'}
      subtitle="Скидка подключается автоматически, когда клиент подходит по условиям"
      icon={<BadgePercent />}
      size="medium"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            disabled={saving || draft.name.trim().length < 2}
            onClick={() =>
              onSubmit({
                name: draft.name.trim(),
                kind: draft.kind,
                value: Number(draft.value) || 0,
                scope: draft.scope,
                itemIds: draft.scope === 'all' ? [] : draft.itemIds,
                minAmount: Number(draft.minAmount) || 0,
                audience: draft.audience,
                auto: draft.auto,
                priority: Number(draft.priority) || 0,
                startsOn: draft.startsOn || null,
                endsOn: draft.endsOn || null,
                isActive: draft.isActive,
                note: draft.note
              })
            }
          >
            {discount ? 'Сохранить' : 'Создать скидку'}
          </button>
        </>
      }
    >
      <div className="mk-form">
        {error && (
          <div className="cl-form__error" role="alert">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="input"
            value={draft.name}
            maxLength={90}
            placeholder="Например, скидка на первый визит"
            onChange={(event) => set('name', event.target.value)}
          />
        </label>

        <div className="mk-form__row">
          <div className="field">
            <span className="field__label">Тип скидки</span>
            <div className="mk-toggle">
              <button
                type="button"
                className="mk-toggle__btn"
                data-active={draft.kind === 'percent' || undefined}
                onClick={() => set('kind', 'percent')}
              >
                <Percent /> Процент
              </button>
              <button
                type="button"
                className="mk-toggle__btn"
                data-active={draft.kind === 'fixed' || undefined}
                onClick={() => set('kind', 'fixed')}
              >
                <CircleDollarSign /> Сумма
              </button>
            </div>
          </div>
          <label className="field">
            <span className="field__label">{draft.kind === 'percent' ? 'Размер, %' : 'Сумма скидки'}</span>
            <input
              className="input"
              type="number"
              min={0}
              max={draft.kind === 'percent' ? 100 : undefined}
              value={draft.value}
              onChange={(event) => set('value', event.target.value)}
            />
          </label>
        </div>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Действует с</span>
            <input
              className="input"
              type="date"
              value={draft.startsOn}
              onChange={(event) => set('startsOn', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Действует до</span>
            <input className="input" type="date" value={draft.endsOn} onChange={(event) => set('endsOn', event.target.value)} />
          </label>
        </div>

        <div className="field">
          <span className="field__label">Кому доступна</span>
          <div className="mk-chips">
            {AUDIENCES.map((audience) => (
              <button
                key={audience.id}
                type="button"
                className="mk-chip"
                data-active={draft.audience === audience.id || undefined}
                title={audience.hint}
                onClick={() => set('audience', audience.id)}
              >
                {audience.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">К чему применяется</span>
          <div className="mk-toggle">
            {[
              { id: 'all' as const, label: 'Всё' },
              { id: 'service' as const, label: 'Услуги' },
              { id: 'package' as const, label: 'Пакеты' }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                className="mk-toggle__btn"
                data-active={draft.scope === option.id || undefined}
                onClick={() => {
                  set('scope', option.id);
                  set('itemIds', []);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          {draft.scope !== 'all' && (
            <div className="mk-picker">
              {items.length === 0 && <span className="mk-picker__empty">Нет активных элементов</span>}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mk-picker__item"
                  data-active={draft.itemIds.includes(item.id) || undefined}
                  onClick={() => toggleItem(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Минимальная сумма</span>
            <input
              className="input"
              type="number"
              min={0}
              value={draft.minAmount}
              onChange={(event) => set('minAmount', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Приоритет</span>
            <input
              className="input"
              type="number"
              value={draft.priority}
              onChange={(event) => set('priority', event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Заметка для себя</span>
          <input
            className="input"
            value={draft.note}
            maxLength={300}
            placeholder="Условия, источник, кто согласовал"
            onChange={(event) => set('note', event.target.value)}
          />
        </label>

        <div className="mk-switch-row">
          <span className="mk-switch-row__icon">
            <Gift />
          </span>
          <div>
            <b>Скидка активна</b>
            <em>Выключенная скидка не применяется, но остаётся в списке</em>
          </div>
          <Switch checked={draft.isActive} label="Скидка активна" onChange={(value) => set('isActive', value)} />
        </div>
      </div>
    </Modal>
  );
}
