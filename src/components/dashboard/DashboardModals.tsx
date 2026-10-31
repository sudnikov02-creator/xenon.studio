import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { METRIC_META, METRIC_ORDER, WIDGET_CONFIG_FIELDS, WIDGET_META } from '../../lib/dashboard';
import { formatDayTime } from '../../lib/utils';
import type { BookingSummary, DashboardLayout, MetricKey, WidgetId } from '../../types';

export function CustomizeDashboardModal({
  open,
  layout,
  onClose,
  onToggleMetric,
  onToggleWidget,
  onMoveWidget,
  onReset
}: {
  open: boolean;
  layout: DashboardLayout;
  onClose: () => void;
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
      subtitle="Выберите метрики и виджеты. Порядок меняется стрелками или перетаскиванием."
      size="medium"
      icon={<SlidersHorizontal />}
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
            <p>Четыре цифры над виджетами. Скрытые метрики не занимают место.</p>
          </div>
          <div className="customize__list">
            {METRIC_ORDER.map((key) => {
              const meta = METRIC_META[key];
              const Icon = meta.icon;
              return (
                <div className="customize__row" key={key} data-hidden={!layout.metrics[key]}>
                  <span className={`customize__icon customize__icon--${meta.tone}`}>
                    <Icon />
                  </span>
                  <div className="customize__text">
                    <b>{meta.label}</b>
                    <em>{meta.kind === 'money' ? 'Сумма и средний чек' : 'Количество за текущий месяц'}</em>
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
            <p>Порядок виджетов на странице. Дашборд сохраняется автоматически.</p>
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
                      aria-label={`Переместить «${meta.title}» выше`}
                      disabled={index === 0}
                      onClick={() => onMoveWidget(widget.id, -1)}
                    >
                      <ChevronUp />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--bordered customize__arrow"
                      aria-label={`Переместить «${meta.title}» ниже`}
                      disabled={index === layout.widgets.length - 1}
                      onClick={() => onMoveWidget(widget.id, 1)}
                    >
                      <ChevronDown />
                    </button>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onChange={(value) => onToggleWidget(widget.id, value)}
                    label={`Показывать виджет «${meta.title}»`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="customize__hint">
          <SlidersHorizontal />
          <span>Изменения сохраняются сразу и применяются на всех устройствах — перезагрузка не нужна.</span>
        </div>
      </div>
    </Modal>
  );
}

export function WidgetConfigModal({
  widgetId,
  config,
  onClose,
  onToggle
}: {
  widgetId: WidgetId | null;
  config: Record<string, boolean>;
  onClose: () => void;
  onToggle: (id: WidgetId, key: string, value: boolean) => void;
}) {
  const meta = widgetId ? WIDGET_META[widgetId] : null;
  const fields = widgetId ? WIDGET_CONFIG_FIELDS[widgetId] : [];

  return (
    <Modal
      open={Boolean(widgetId)}
      onClose={onClose}
      title={meta ? `Настройка «${meta.title}»` : 'Настройка виджета'}
      subtitle="Что показывать внутри виджета"
      size="narrow"
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
        {widgetId &&
          fields.map((field) => (
            <div className="config-row" key={field.key}>
              <div>
                <b>{field.label}</b>
                <span>{field.hint}</span>
              </div>
              <Switch
                checked={config[field.key] !== false}
                onChange={(value) => onToggle(widgetId, field.key, value)}
                label={field.label}
              />
            </div>
          ))}
        {fields.length === 0 && (
          <p className="config-empty">У этого виджета нет параметров — он всегда показывает полный месяц.</p>
        )}
      </div>
    </Modal>
  );
}

export function DeclineBookingModal({
  booking,
  timezone,
  busy,
  onClose,
  onSubmit
}: {
  booking: BookingSummary | null;
  timezone: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (booking) setComment('');
  }, [booking]);

  return (
    <Modal
      open={Boolean(booking)}
      onClose={onClose}
      title="Отклонить заявку"
      subtitle={booking ? `${booking.client?.name || 'Клиент'} · ${formatDayTime(booking.startsAt, timezone)}` : ''}
      size="narrow"
      icon={<XCircle />}
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
          Клиент получит уведомление об отказе. Если хотите сохранить отношения — коротко объясните причину и
          предложите другую дату.
        </p>
        <label className="field">
          <span className="field__label">Комментарий для клиента (необязательно)</span>
          <textarea
            className="textarea"
            value={comment}
            maxLength={600}
            rows={4}
            placeholder="Например: к сожалению, эта дата уже занята. Могу предложить 2 ноября после 15:00."
            onChange={(event) => setComment(event.target.value)}
          />
          <span className="decline-counter">{comment.length}/600</span>
        </label>
      </div>
    </Modal>
  );
}
