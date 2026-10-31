import { useCallback, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { bookingsLabel, formatDuration, formatPrice } from '../../lib/services';
import type { Service } from '../../types';

export function ServiceCard({
  service,
  currency,
  canUp,
  canDown,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onMove
}: {
  service: Service;
  currency: string;
  canUp: boolean;
  canDown: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismissable<HTMLDivElement>(menuOpen, closeMenu);

  return (
    <article className="srv-card card" data-hidden={!service.isActive}>
      <div className="srv-card__head">
        <div className="srv-card__title">
          <h3>{service.name}</h3>
          <span className="badge" data-tone={service.isActive ? 'success' : 'muted'}>
            {service.isActive ? 'Доступна' : 'Скрыта'}
          </span>
        </div>
        <div className="srv-card__menu" ref={menuRef}>
          <button
            type="button"
            className="btn btn--icon btn--bordered"
            aria-label={`Действия с услугой «${service.name}»`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <MoreHorizontal />
          </button>
          {menuOpen && (
            <div className="srv-menu" role="menu">
              <button
                type="button"
                className="srv-menu__item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onEdit();
                }}
              >
                <Pencil /> Редактировать
              </button>
              <button
                type="button"
                className="srv-menu__item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onDuplicate();
                }}
              >
                <Copy /> Дублировать
              </button>
              <button
                type="button"
                className="srv-menu__item"
                role="menuitem"
                disabled={!canUp}
                onClick={() => {
                  closeMenu();
                  onMove(-1);
                }}
              >
                <ArrowUp /> Переместить выше
              </button>
              <button
                type="button"
                className="srv-menu__item"
                role="menuitem"
                disabled={!canDown}
                onClick={() => {
                  closeMenu();
                  onMove(1);
                }}
              >
                <ArrowDown /> Переместить ниже
              </button>
              <div className="srv-menu__divider" />
              <button
                type="button"
                className="srv-menu__item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onToggle();
                }}
              >
                {service.isActive ? <EyeOff /> : <Eye />}
                {service.isActive ? 'Скрыть из записи' : 'Показать клиентам'}
              </button>
              <button
                type="button"
                className="srv-menu__item srv-menu__item--danger"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <Trash2 /> Удалить
              </button>
            </div>
          )}
        </div>
      </div>

      {service.description && <p className="srv-card__text">{service.description}</p>}

      <div className="srv-card__metrics">
        <div className="srv-metric srv-metric--price">
          <span>Цена</span>
          <b className="tnum">{formatPrice(service.price, currency)}</b>
        </div>
        <div className="srv-metric">
          <span>Длительность</span>
          <b>{formatDuration(service.duration)}</b>
        </div>
        <div className="srv-metric">
          <span>Буфер</span>
          <b>{service.buffer > 0 ? formatDuration(service.buffer) : 'Нет'}</b>
        </div>
      </div>

      <div className="srv-card__addons">
        {service.addons.length === 0 ? (
          <span className="srv-card__addons-empty">Без дополнительных опций</span>
        ) : (
          <>
            {service.addons.slice(0, 3).map((addon) => (
              <span className="addon-chip" key={addon.id}>
                <Plus />
                {addon.name}
                <em>
                  {formatPrice(addon.price, currency)}
                  {addon.type === 'quantity' ? ` / ${addon.unit || 'шт'}` : ''}
                </em>
              </span>
            ))}
            {service.addons.length > 3 && (
              <span className="addon-chip addon-chip--more">+{service.addons.length - 3}</span>
            )}
          </>
        )}
      </div>

      <div className="srv-card__foot">
        <span className="srv-card__usage">
          <Clock3 /> {bookingsLabel(service.bookings)}
        </span>
        <button type="button" className="btn btn--sm" onClick={onEdit}>
          <Pencil /> Изменить
        </button>
      </div>
    </article>
  );
}
