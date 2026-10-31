import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Package as PackageIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { AddonEditor } from './AddonEditor';
import { formatDuration, formatPrice, normalizeDraftAddons } from '../../lib/services';
import type { PackageDraft, Service, ServicePackage } from '../../types';

const empty: PackageDraft = {
  name: '',
  description: '',
  price: 0,
  serviceIds: [],
  addons: [],
  isActive: true
};

export function PackageModal({
  open,
  item,
  services,
  currency,
  saving,
  serverError,
  onClose,
  onSubmit
}: {
  open: boolean;
  item: ServicePackage | null;
  services: Service[];
  currency: string;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (draft: PackageDraft) => void;
}) {
  const [draft, setDraft] = useState<PackageDraft>(empty);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDraft(
      item
        ? {
            name: item.name,
            description: item.description || '',
            price: item.price,
            serviceIds: [...item.serviceIds],
            addons: item.addons.map((addon) => ({ ...addon })),
            isActive: item.isActive
          }
        : empty
    );
  }, [open, item]);

  const selected = useMemo(
    () => services.filter((service) => draft.serviceIds.includes(service.id)),
    [draft.serviceIds, services]
  );
  const sum = selected.reduce((total, service) => total + service.price, 0);
  const duration = selected.reduce((total, service) => total + service.duration, 0);
  const saving_ = Math.max(0, sum - draft.price);

  const errors = useMemo(() => {
    const list: Record<string, string> = {};
    if (draft.name.trim().length < 2) list.name = 'Название — минимум 2 символа';
    if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) list.price = 'Укажите цену';
    if (draft.serviceIds.length === 0) list.services = 'Выберите хотя бы одну услугу';
    return list;
  }, [draft]);

  const set = <K extends keyof PackageDraft>(key: K, value: PackageDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleService = (id: number) => {
    setDraft((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((itemId) => itemId !== id)
        : [...prev.serviceIds, id]
    }));
  };

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: Math.max(0, Math.round(Number(draft.price) || 0)),
      addons: normalizeDraftAddons(draft.addons)
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Редактирование пакета' : 'Новый пакет'}
      subtitle="Несколько услуг по одной цене — выгодно клиенту и удобно для студии"
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
            onClick={submit}
            disabled={saving}
          >
            {item ? 'Сохранить' : 'Создать пакет'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        {serverError && (
          <div className="form-alert">
            <AlertCircle />
            {serverError}
          </div>
        )}

        <label className="field">
          <span className="field__label">Название</span>
          <input
            className={`input${touched && errors.name ? ' input--invalid' : ''}`}
            value={draft.name}
            maxLength={80}
            placeholder="Портрет + визаж"
            onChange={(event) => set('name', event.target.value)}
          />
          {touched && errors.name ? <span className="field__error">{errors.name}</span> : null}
        </label>

        <label className="field">
          <span className="field__label">Описание</span>
          <textarea
            className="textarea"
            value={draft.description}
            maxLength={600}
            rows={2}
            placeholder="Что входит в пакет и чем он выгоден"
            onChange={(event) => set('description', event.target.value)}
          />
        </label>

        <div className="form-section">
          <div className="form-section__head">
            <div>
              <b>
                <PackageIcon /> Услуги в пакете
              </b>
              <span>Отметьте услуги, которые входят в пакет.</span>
            </div>
            {touched && errors.services ? <span className="field__error">{errors.services}</span> : null}
          </div>
          <div className="pick-list">
            {services.map((service) => {
              const active = draft.serviceIds.includes(service.id);
              return (
                <button
                  type="button"
                  key={service.id}
                  className="pick-row"
                  data-active={active}
                  onClick={() => toggleService(service.id)}
                  aria-pressed={active}
                >
                  <span className="pick-row__check">{active ? <Check /> : null}</span>
                  <span className="pick-row__text">
                    <b>{service.name}</b>
                    <em>
                      {formatDuration(service.duration)} · {formatPrice(service.price, currency)}
                    </em>
                  </span>
                </button>
              );
            })}
            {services.length === 0 && (
              <div className="pick-list__empty">Сначала создайте хотя бы одну услугу.</div>
            )}
          </div>
        </div>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">Цена пакета</span>
            <div className="input-wrap">
              <input
                className={`input${touched && errors.price ? ' input--invalid' : ''}`}
                type="number"
                min={0}
                step={100}
                value={draft.price}
                onChange={(event) => set('price', Number(event.target.value))}
              />
              <span className="input-suffix">{currency}</span>
            </div>
          </label>
          <div className="package-total">
            <span>Сумма услуг по отдельности</span>
            <b>{formatPrice(sum, currency)}</b>
            <em>
              {formatDuration(duration)} · выгода {formatPrice(saving_, currency)}
            </em>
          </div>
        </div>

        <div className="form-toggle-row">
          <div>
            <b>Пакет доступен для записи</b>
            <span>Скрытые пакеты не показываются клиенту.</span>
          </div>
          <Switch checked={draft.isActive} onChange={(value) => set('isActive', value)} label="Пакет доступен" />
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <div>
              <b>Дополнительные опции пакета</b>
              <span>Например, фотокнига или расширенная ретушь.</span>
            </div>
          </div>
          <AddonEditor addons={draft.addons} currency={currency} onChange={(next) => set('addons', next)} />
        </div>
      </div>
    </Modal>
  );
}
