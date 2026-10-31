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
  Percent,
  Trash2
} from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { bookingsLabel, formatDuration, formatPrice, packageTotals } from '../../lib/services';
import type { Service, ServicePackage } from '../../types';

export function PackageCard({
  item,
  services,
  currency,
  canUp,
  canDown,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onMove
}: {
  item: ServicePackage;
  services: Service[];
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
  const totals = packageTotals(item, services);

  return (
    <article className="srv-card srv-card--package card" data-hidden={!item.isActive}>
      <div className="srv-card__head">
        <div className="srv-card__title">
          <h3>{item.name}</h3>
          <span className="badge" data-tone={item.isActive ? 'success' : 'muted'}>
            {item.isActive ? 'Доступен' : 'Скрыт'}
          </span>
        </div>
        <div className="srv-card__menu" ref={menuRef}>
          <button
            type="button"
            className="btn btn--icon btn--bordered"
            aria-label={`Действия с пакетом «${item.name}»`}
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
                {item.isActive ? <EyeOff /> : <Eye />}
                {item.isActive ? 'Скрыть из записи' : 'Показать клиентам'}
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

      {item.description && <p className="srv-card__text">{item.description}</p>}

      <div className="srv-card__metrics">
        <div className="srv-metric srv-metric--price">
          <span>Цена пакета</span>
          <b className="tnum">{formatPrice(item.price, currency)}</b>
        </div>
        <div className="srv-metric">
          <span>По отдельности</span>
          <b className="srv-metric__old tnum">{formatPrice(totals.sum, currency)}</b>
        </div>
        <div className="srv-metric">
          <span>Длительность</span>
          <b>{formatDuration(totals.duration)}</b>
        </div>
      </div>

      {totals.percent > 0 && (
        <div className="package-saving">
          <Percent />
          Выгода для клиента — {formatPrice(totals.saving, currency)} ({totals.percent}%)
        </div>
      )}

      <div className="srv-card__addons">
        {totals.included.length === 0 ? (
          <span className="srv-card__addons-empty">Услуги не выбраны</span>
        ) : (
          totals.included.map((service) => (
            <span className="addon-chip" key={service.id}>
              {service.name}
              <em>{formatPrice(service.price, currency)}</em>
            </span>
          ))
        )}
      </div>

      <div className="srv-card__foot">
        <span className="srv-card__usage">
          <Clock3 /> {bookingsLabel(item.bookings)}
        </span>
        <button type="button" className="btn btn--sm" onClick={onEdit}>
          <Pencil /> Изменить
        </button>
      </div>
    </article>
  );
}
