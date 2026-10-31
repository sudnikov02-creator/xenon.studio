import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  RotateCcw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import {
  METRIC_META,
  METRIC_ORDER,
  WIDGET_CONFIG_FIELDS,
  WIDGET_META
} from '../../lib/dashboard';
import { useSettings } from '../../context/SettingsContext';
import { formatDayTime } from '../../lib/utils';
import type { BookingSummary, DashboardLayout, MetricKey, WidgetId } from '../../types';

export function CustomizeDashboardModal({
  open,
  onClose,
  layout,
  onToggleMetric,
  onToggleWidget,
  onMoveWidget,
  onReset
}: {
  open: boolean;
  onClose: () => void;
  layout: DashboardLayout;
  onToggleMetric: (key: MetricKey) => void;
  onToggleWidget: (id: WidgetId, visible: boolean) => void;
  onMoveWidget: (id: WidgetId, direction: -1 | 1) => void;
  onReset: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Настроить дашборд"
      subtitle="Метрики, виджеты и их порядок"
      icon={<SlidersHorizontal />}
      size="default"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onReset}>
            <RotateCcw /> Сбросить
          </button>
          <div className="spacer" />
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      <div className="customize">
        <section className="customize__section">
          <div className="customize__head">
            <h4>Метрики</h4>
            <p>Верхний ряд карточек с показателями месяца</p>
          </div>
          <div className="customize__list">
            {METRIC_ORDER.map((key) => {
              const meta = METRIC_META[key];
              const Icon = meta.icon;
              return (
                <div className="customize__row" key={key}>
                  <span className={`customize__icon customize__icon--${meta.tone}`}>
                    <Icon />
                  </span>
                  <div className="customize__text">
                    <b>{meta.label}</b>
                    <em>Показатель текущего месяца</em>
                  </div>
                  <Switch
                    checked={layout.metrics[key]}
                    onChange={() => onToggleMetric(key)}
                    label={`Показывать метрику «${meta.label}»`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="customize__section">
          <div className="customize__head">
            <h4>Виджеты</h4>
            <p>Порядок и видимость блоков на дашборде</p>
          </div>
          <div className="customize__list">
            {layout.widgets.map((widget, index) => {
              const meta = WIDGET_META[widget.id];
              const Icon = meta.icon;
              return (
                <div className="customize__row" key={widget.id} data-hidden={!widget.visible}>
                  <span className="customize__icon">
                    <Icon />
                  </span>
                  <div className="customize__text">
                    <b>{meta.title}</b>
                    <em>{meta.description}</em>
                  </div>
                  <div className="customize__order">
                    <button
                      type="button"
                      className="btn btn--icon btn--bordered customize__arrow"
                      onClick={() => onMoveWidget(widget.id, -1)}
                      disabled={index === 0}
                      aria-label={`Переместить «${meta.title}» выше`}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--bordered customize__arrow"
                      onClick={() => onMoveWidget(widget.id, 1)}
                      disabled={index === layout.widgets.length - 1}
                      aria-label={`Переместить «${meta.title}» ниже`}
                    >
                      <ChevronDown />
                    </button>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onChange={(next) => onToggleWidget(widget.id, next)}
                    label={`Показывать виджет «${meta.title}»`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="customize__hint">
          <LayoutGrid />
          <span>Виджеты можно перетаскивать прямо на дашборде — за иконку с точками в правом верхнем углу.</span>
        </div>
      </div>
    </Modal>
  );
}

export function WidgetConfigModal({
  widgetId,
  layout,
  onToggleField,
  onClose
}: {
  widgetId: WidgetId | null;
  layout: DashboardLayout;
  onToggleField: (id: WidgetId, key: string, value: boolean) => void;
  onClose: () => void;
}) {
  const widget = widgetId ? layout.widgets.find((item) => item.id === widgetId) : null;
  const meta = widgetId ? WIDGET_META[widgetId] : null;
  const fields = widgetId ? WIDGET_CONFIG_FIELDS[widgetId] : [];
  const Icon = meta?.icon;

  return (
    <Modal
      open={Boolean(widgetId && meta && fields.length > 0)}
      onClose={onClose}
      title={meta ? `Настройка · ${meta.title}` : 'Настройка виджета'}
      subtitle="Что показывать внутри блока"
      icon={Icon ? <Icon /> : undefined}
      footer={
        <>
          <div className="spacer" />
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      <div className="config-list">
        {fields.map((field) => (
          <div className="config-row" key={field.key}>
            <div>
              <b>{field.label}</b>
              {field.hint && <span>{field.hint}</span>}
            </div>
            <Switch
              checked={widget ? widget.config[field.key] !== false : true}
              onChange={(next) => widgetId && onToggleField(widgetId, field.key, next)}
              label={field.label}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function DeclineBookingModal({
  booking,
  busy,
  onClose,
  onSubmit
}: {
  booking: BookingSummary | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const { branding } = useSettings();
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (booking) setComment('');
  }, [booking]);

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title="Отклонить заявку"
      subtitle={
        booking
          ? `${booking.client?.name || 'Клиент'} · ${formatDayTime(booking.startsAt, branding.timezone)}`
          : undefined
      }
      icon={<X />}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--danger${busy ? ' btn--loading' : ''}`}
            onClick={() => onSubmit(comment.trim())}
            disabled={busy}
          >
            Отклонить заявку
          </button>
        </>
      }
    >
      <div className="decline-body">
        <p>
          Клиент увидит этот комментарий на своей странице записи. Он поможет объяснить решение — или оставьте
          поле пустым.
        </p>
        <label className="field">
          <span className="field__label">Комментарий для клиента</span>
          <textarea
            className="textarea"
            value={comment}
            maxLength={600}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Например: к сожалению, эта дата уже занята — предложу ближайшие свободные дни"
          />
        </label>
        <div className="decline-counter">{comment.length} / 600</div>
      </div>
    </Modal>
  );
}
