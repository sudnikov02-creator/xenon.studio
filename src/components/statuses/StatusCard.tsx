import { CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CalendarX2,
  Check,
  Flag,
  GripVertical,
  Pencil,
  Trash2,
  XCircle
} from 'lucide-react';
import { plural } from '../../lib/utils';
import type { StatusSettingsItem } from '../../types';

export function StatusCard({
  status,
  index,
  total,
  active,
  onEdit,
  onDelete,
  onShift,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  status: StatusSettingsItem;
  index: number;
  total: number;
  active: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShift: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      className="st-card"
      style={{ '--status': status.color } as CSSProperties}
      data-active={active || undefined}
      data-cancelled={status.isCancelled || undefined}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(status.id));
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOver(event);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <span className="st-card__grip" aria-hidden>
        <GripVertical />
      </span>

      <div className="st-card__main">
        <div className="st-card__top">
          <span className="st-card__dot" aria-hidden />
          <b>{status.name}</b>
          <div className="st-card__flags">
            {status.isInitial && (
              <span className="st-flag st-flag--initial" title="С этого статуса начинается заявка">
                <Flag /> старт
              </span>
            )}
            {status.isFinal && (
              <span className="st-flag st-flag--final" title="Съёмка завершена">
                <Check /> финал
              </span>
            )}
            {status.isCancelled && (
              <span className="st-flag st-flag--cancel" title="Отменяет запись">
                <XCircle /> отмена
              </span>
            )}
          </div>
          <span className="st-card__count">
            {status.bookings} {plural(status.bookings, 'запись', 'записи', 'записей')}
          </span>
        </div>

        <div className="st-card__perms">
          <span data-on={status.clientCanReschedule || undefined}>
            <CalendarCheck /> клиент переносит
          </span>
          <span data-on={status.clientCanCancel || undefined}>
            <CalendarX2 /> клиент отменяет
          </span>
          {status.upcoming > 0 && <span className="st-card__upcoming">{status.upcoming} впереди</span>}
        </div>
      </div>

      <div className="st-card__actions">
        <button
          type="button"
          className="btn btn--icon btn--ghost btn--sm"
          aria-label="Выше"
          disabled={index === 0}
          onClick={() => onShift(-1)}
        >
          <ArrowUp />
        </button>
        <button
          type="button"
          className="btn btn--icon btn--ghost btn--sm"
          aria-label="Ниже"
          disabled={index === total - 1}
          onClick={() => onShift(1)}
        >
          <ArrowDown />
        </button>
        <button type="button" className="btn btn--icon btn--bordered btn--sm" aria-label="Изменить" onClick={onEdit}>
          <Pencil />
        </button>
        <button
          type="button"
          className="btn btn--icon btn--ghost btn--sm st-card__delete"
          aria-label="Удалить"
          onClick={onDelete}
        >
          <Trash2 />
        </button>
      </div>
    </article>
  );
}
