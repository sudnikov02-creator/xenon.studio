import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { AddonEditor } from './AddonEditor';
import { BUFFER_OPTIONS, DURATION_OPTIONS, formatDuration, normalizeDraftAddons } from '../../lib/services';
import type { Service, ServiceAddon, ServiceDraft } from '../../types';

const empty: ServiceDraft = {
  name: '',
  description: '',
  price: 0,
  duration: 60,
  buffer: 15,
  addons: [],
  isActive: true
};

export function ServiceModal({
  open,
  service,
  currency,
  saving,
  serverError,
  onClose,
  onSubmit
}: {
  open: boolean;
  service: Service | null;
  currency: string;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (draft: ServiceDraft) => void;
}) {
  const [draft, setDraft] = useState<ServiceDraft>(empty);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDraft(
      service
        ? {
            name: service.name,
            description: service.description || '',
            price: service.price,
            duration: service.duration,
            buffer: service.buffer,
            addons: service.addons.map((addon) => ({ ...addon })),
            isActive: service.isActive
          }
        : empty
    );
  }, [open, service]);

  const errors = useMemo(() => {
    const list: Record<string, string> = {};
    if (draft.name.trim().length < 2) list.name = 'Название — минимум 2 символа';
    if (!Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) list.price = 'Укажите цену';
    if (Number(draft.duration) < 15) list.duration = 'Минимум 15 минут';
    return list;
  }, [draft]);

  const set = <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

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

  const addons: ServiceAddon[] = draft.addons;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? 'Редактирование услуги' : 'Новая услуга'}
      subtitle={service ? service.name : 'Что клиент сможет выбрать при записи'}
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
            {service ? 'Сохранить' : 'Создать услугу'}
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
            placeholder="Портретная съёмка"
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
            rows={3}
            placeholder="Что входит в съёмку: время, количество кадров, помощь с образами"
            onChange={(event) => set('description', event.target.value)}
          />
          <span className="field__hint">Показывается клиенту на странице записи.</span>
        </label>

        <div className="form-grid form-grid--3">
          <label className="field">
            <span className="field__label">Цена</span>
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

          <label className="field">
            <span className="field__label">Длительность</span>
            <select
              className="select"
              value={draft.duration}
              onChange={(event) => set('duration', Number(event.target.value))}
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option value={minutes} key={minutes}>
                  {formatDuration(minutes)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Буфер после</span>
            <select
              className="select"
              value={draft.buffer}
              onChange={(event) => set('buffer', Number(event.target.value))}
            >
              {BUFFER_OPTIONS.map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes === 0 ? 'Без буфера' : formatDuration(minutes)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-toggle-row">
          <div>
            <b>Услуга доступна для записи</b>
            <span>Скрытые услуги остаются в истории, но не попадают в форму записи.</span>
          </div>
          <Switch checked={draft.isActive} onChange={(value) => set('isActive', value)} label="Услуга доступна" />
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <div>
              <b>
                <Sparkles /> Дополнительные опции
              </b>
              <span>Клиент сможет добавить их к услуге — цена прибавится к итоговой сумме.</span>
            </div>
          </div>
          <AddonEditor addons={addons} currency={currency} onChange={(next) => set('addons', next)} />
        </div>
      </div>
    </Modal>
  );
}
