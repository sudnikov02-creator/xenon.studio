import { CSSProperties, useEffect, useState } from 'react';
import { Check, CircleDot, Flag, TriangleAlert, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { cn } from '../../lib/utils';
import type { StatusDraft, StatusSettingsItem } from '../../types';

const PALETTE = [
  '#2563eb',
  '#0ea5e9',
  '#0891b2',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#16a34a',
  '#14b8a6',
  '#64748b'
];

const EMPTY: StatusDraft = {
  name: '',
  color: PALETTE[0],
  isInitial: false,
  isFinal: false,
  isCancelled: false,
  clientCanReschedule: true,
  clientCanCancel: true
};

export function StatusModal({
  open,
  status,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  status: StatusSettingsItem | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: StatusDraft) => void;
}) {
  const [draft, setDraft] = useState<StatusDraft>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setDraft(
      status
        ? {
            name: status.name,
            color: status.color,
            isInitial: status.isInitial,
            isFinal: status.isFinal,
            isCancelled: status.isCancelled,
            clientCanReschedule: status.clientCanReschedule,
            clientCanCancel: status.clientCanCancel
          }
        : { ...EMPTY, color: PALETTE[Math.floor(Math.random() * 5)] }
    );
  }, [open, status]);

  const set = <K extends keyof StatusDraft>(key: K, value: StatusDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={status ? 'Изменить статус' : 'Новый статус'}
      subtitle={status ? `${status.bookings} записей в этом статусе` : 'Добавьте шаг в цепочку работы с записями'}
      icon={<CircleDot />}
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
            onClick={() => onSubmit({ ...draft, name: draft.name.trim() })}
            disabled={saving || !draft.name.trim()}
          >
            {status ? 'Сохранить' : 'Создать статус'}
          </button>
        </>
      }
    >
      <div className="st-form">
        <div className="st-preview" style={{ '--status': draft.color } as CSSProperties}>
          <span className="st-preview__label">Как увидят</span>
          <span className="bstatus" style={{ '--status': draft.color } as CSSProperties}>
            <i aria-hidden />
            {draft.name.trim() || 'Название статуса'}
          </span>
          {draft.isInitial && (
            <span className="st-flag st-flag--initial">
              <Flag /> старт
            </span>
          )}
          {draft.isFinal && (
            <span className="st-flag st-flag--final">
              <Check /> финал
            </span>
          )}
          {draft.isCancelled && (
            <span className="st-flag st-flag--cancel">
              <XCircle /> отмена
            </span>
          )}
        </div>

        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="input"
            value={draft.name}
            maxLength={40}
            autoFocus
            placeholder="Например: Кадры отправлены"
            onChange={(event) => set('name', event.target.value)}
          />
          <span className="field__hint">Видно фотографу и клиенту на его странице записи.</span>
        </label>

        <div className="field">
          <span className="field__label">Цвет</span>
          <div className="st-palette">
            {PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={cn('st-swatch', draft.color.toLowerCase() === color && 'is-active')}
                style={{ '--swatch': color } as CSSProperties}
                aria-label={`Цвет ${color}`}
                aria-pressed={draft.color.toLowerCase() === color}
                onClick={() => set('color', color)}
              >
                {draft.color.toLowerCase() === color && <Check />}
              </button>
            ))}
            <label className="st-swatch st-swatch--custom" style={{ '--swatch': draft.color } as CSSProperties}>
              <input
                type="color"
                value={draft.color}
                aria-label="Свой цвет"
                onChange={(event) => set('color', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="st-toggles">
          <div className="st-toggle">
            <span>
              <b>Стартовый статус</b>
              <em>Сюда попадают новые заявки с сайта</em>
            </span>
            <Switch checked={draft.isInitial} label="Стартовый статус" onChange={(value) => set('isInitial', value)} />
          </div>

          <div className="st-toggle">
            <span>
              <b>Финальный статус</b>
              <em>Съёмка завершена — менять уже нечего</em>
            </span>
            <Switch checked={draft.isFinal} label="Финальный статус" onChange={(value) => set('isFinal', value)} />
          </div>

          <div className="st-toggle">
            <span>
              <b>Статус отмены</b>
              <em>Запись считается отменённой и уходит из активных</em>
            </span>
            <Switch
              checked={draft.isCancelled}
              label="Статус отмены"
              onChange={(value) => set('isCancelled', value)}
            />
          </div>
        </div>

        <div className="st-form__group">
          <span className="st-form__legend">Что может клиент на странице записи</span>
          <div className="st-toggle">
            <span>
              <b>Перенести съёмку</b>
              <em>Выбор свободного времени вместо переписки</em>
            </span>
            <Switch
              checked={draft.clientCanReschedule}
              label="Клиент может перенести"
              onChange={(value) => set('clientCanReschedule', value)}
            />
          </div>
          <div className="st-toggle">
            <span>
              <b>Отменить запись</b>
              <em>С причиной, фотограф получит уведомление</em>
            </span>
            <Switch
              checked={draft.clientCanCancel}
              label="Клиент может отменить"
              onChange={(value) => set('clientCanCancel', value)}
            />
          </div>
        </div>

        {error && (
          <div className="st-form__error" role="alert">
            <TriangleAlert />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
