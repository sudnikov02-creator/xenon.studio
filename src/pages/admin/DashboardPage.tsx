import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  Plus,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/ui/PageHead';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { WidgetFrame } from '../../components/dashboard/WidgetFrame';
import { TodayWidget } from '../../components/dashboard/TodayWidget';
import { PendingWidget } from '../../components/dashboard/PendingWidget';
import { MiniCalendarWidget } from '../../components/dashboard/MiniCalendarWidget';
import { RevenueWidget } from '../../components/dashboard/RevenueWidget';
import {
  CustomizeDashboardModal,
  DeclineBookingModal,
  WidgetConfigModal
} from '../../components/dashboard/DashboardModals';
import { useSettings } from '../../context/SettingsContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { METRIC_ORDER, WIDGET_META, normalizeLayout } from '../../lib/dashboard';
import { formatDate, formatDayTime, formatTimeIn, greeting, plural } from '../../lib/utils';
import { useWidgetDrag } from '../../hooks/useWidgetDrag';
import type {
  BookingSummary,
  CalendarData,
  DashboardData,
  DashboardLayout,
  MetricKey,
  WidgetId
} from '../../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const { settings, branding, updateSettings } = useSettings();
  const { subscribe, connected } = useRealtime();
  const { toast } = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [configWidget, setConfigWidget] = useState<WidgetId | null>(null);
  const [declineTarget, setDeclineTarget] = useState<BookingSummary | null>(null);
  const [declining, setDeclining] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const mounted = useRef(true);

  const layout = useMemo(() => normalizeLayout(settings?.dashboard), [settings?.dashboard]);
  const visibleWidgets = useMemo(() => layout.widgets.filter((widget) => widget.visible), [layout]);
  const visibleIds = useMemo(() => visibleWidgets.map((widget) => widget.id), [visibleWidgets]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get<DashboardData>('/dashboard');
      if (!mounted.current) return;
      setData(response);
      setCalendar(response.calendar);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      if (!silent) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить данные');
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribe('booking', () => {
      void load({ silent: true });
    });
  }, [subscribe, load]);

  const persistLayout = useCallback(
    async (next: DashboardLayout) => {
      try {
        await updateSettings({ dashboard: next });
      } catch (err) {
        toast({
          title: 'Не удалось сохранить настройки',
          subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
          variant: 'error'
        });
      }
    },
    [updateSettings, toast]
  );

  const commitOrder = useCallback(
    (order: WidgetId[]) => {
      const byId = new Map(layout.widgets.map((widget) => [widget.id, widget]));
      const hidden = layout.widgets.filter((widget) => !widget.visible);
      const widgets = order
        .map((id) => byId.get(id))
        .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget))
        .concat(hidden);
      void persistLayout({ ...layout, widgets });
    },
    [layout, persistLayout]
  );

  const { drag, placeholderIndex, start } = useWidgetDrag({ visibleIds, onCommit: commitOrder });

  const toggleMetric = (key: MetricKey) => {
    void persistLayout({ ...layout, metrics: { ...layout.metrics, [key]: !layout.metrics[key] } });
  };

  const toggleWidget = (id: WidgetId, visible: boolean) => {
    void persistLayout({
      ...layout,
      widgets: layout.widgets.map((widget) => (widget.id === id ? { ...widget, visible } : widget))
    });
  };

  const moveWidget = (id: WidgetId, direction: -1 | 1) => {
    const index = layout.widgets.findIndex((widget) => widget.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layout.widgets.length) return;
    const widgets = [...layout.widgets];
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
    void persistLayout({ ...layout, widgets });
  };

  const toggleWidgetConfig = (id: WidgetId, key: string, value: boolean) => {
    void persistLayout({
      ...layout,
      widgets: layout.widgets.map((widget) =>
        widget.id === id ? { ...widget, config: { ...widget.config, [key]: value } } : widget
      )
    });
  };

  const resetLayout = () => {
    void persistLayout(normalizeLayout(null));
    toast({ title: 'Дашборд сброшен к стандартному виду', variant: 'info' });
  };

  const changeMonth = async (month: string) => {
    setCalendarLoading(true);
    try {
      const response = await api.get<CalendarData>(`/dashboard/calendar?month=${month}`);
      if (!mounted.current) return;
      setCalendar(response);
    } catch (err) {
      toast({
        title: 'Не удалось загрузить месяц',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      if (mounted.current) setCalendarLoading(false);
    }
  };

  const acceptBooking = async (booking: BookingSummary) => {
    setBusyId(booking.id);
    try {
      await api.post(`/bookings/${booking.id}/accept`);
      toast({
        title: 'Заявка подтверждена',
        subtitle: `${booking.client?.name || 'Клиент'} · ${formatDayTime(booking.startsAt, branding.timezone)}`,
        variant: 'success',
        action: { label: 'Открыть записи', onClick: () => navigate('/admin/bookings') }
      });
      await load({ silent: true });
    } catch (err) {
      const already = err instanceof ApiError && err.code === 'already_processed';
      toast({
        title: already ? 'Заявка уже обработана' : 'Не удалось подтвердить заявку',
        subtitle: already ? 'Обновите список — статус уже изменился' : err instanceof ApiError ? err.message : undefined,
        variant: already ? 'info' : 'error'
      });
      await load({ silent: true });
    } finally {
      if (mounted.current) setBusyId(null);
    }
  };

  const declineBooking = async (comment: string) => {
    if (!declineTarget) return;
    setDeclining(true);
    try {
      await api.post(`/bookings/${declineTarget.id}/decline`, { comment });
      toast({
        title: 'Заявка отклонена',
        subtitle: declineTarget.client?.name || 'Клиент',
        variant: 'info'
      });
      setDeclineTarget(null);
      await load({ silent: true });
    } catch (err) {
      toast({
        title: 'Не удалось отклонить заявку',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      if (mounted.current) setDeclining(false);
    }
  };

  const metricKeys = METRIC_ORDER.filter((key) => layout.metrics[key]);
  const firstName = (settings?.photographerName || branding.photographerName || 'Ксения').split(' ')[0];
  const dateLabel = formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: branding.timezone
  });
  const monthBookings = data?.metrics.bookings.value ?? 0;

  const renderList: ({ type: 'widget'; id: WidgetId } | { type: 'placeholder' })[] = [];
  visibleWidgets
    .filter((widget) => widget.id !== drag?.id)
    .forEach((widget) => renderList.push({ type: 'widget', id: widget.id }));
  if (drag && placeholderIndex !== null) {
    renderList.splice(Math.min(placeholderIndex, renderList.length), 0, { type: 'placeholder' });
  }

  const widgetBody = (id: WidgetId, config: Record<string, boolean>) => {
    if (!data) return null;
    switch (id) {
      case 'today':
        return (
          <TodayWidget
            bookings={data.todayBookings}
            next={data.next}
            timezone={branding.timezone}
            currencySymbol={branding.currencySymbol}
            decimalSeparator={branding.decimalSeparator}
            showPrice={config.showPrice !== false}
            showStatus={config.showStatus !== false}
          />
        );
      case 'pending':
        return (
          <PendingWidget
            items={data.pending.slice(0, 5)}
            timezone={branding.timezone}
            currencySymbol={branding.currencySymbol}
            decimalSeparator={branding.decimalSeparator}
            showPrice={config.showPrice !== false}
            busyId={busyId}
            onAccept={(booking) => void acceptBooking(booking)}
            onDecline={(booking) => setDeclineTarget(booking)}
          />
        );
      case 'calendar':
        return (
          <MiniCalendarWidget
            calendar={calendar}
            loading={calendarLoading}
            timezone={branding.timezone}
            onMonthChange={(month) => void changeMonth(month)}
          />
        );
      case 'revenue':
        return (
          <RevenueWidget
            revenue={data.revenue}
            currencySymbol={branding.currencySymbol}
            decimalSeparator={branding.decimalSeparator}
            compare={config.compare !== false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="page dashboard">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        subtitle={`${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · ${monthBookings} ${plural(
          monthBookings,
          'съёмка',
          'съёмки',
          'съёмок'
        )} в этом месяце`}
        badge={<span className="badge badge--accent">Этап 2</span>}
        actions={
          <>
            <span className={`live-pill ${connected ? 'is-online' : ''}`} title={connected ? 'Обновления в реальном времени' : 'Восстанавливаем соединение'}>
              <Radio />
              {connected ? 'На связи' : 'Подключаемся'}
            </span>
            <button type="button" className="btn" onClick={() => setCustomizeOpen(true)}>
              <SlidersHorizontal /> Настроить
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/admin/bookings')}>
              <Plus /> Новая запись
            </button>
          </>
        }
      />

      {error && (
        <div className="card dashboard-error">
          <span className="dashboard-error__icon">
            <TriangleAlert />
          </span>
          <div>
            <b>Не удалось загрузить дашборд</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            <RefreshCw /> Повторить
          </button>
        </div>
      )}

      {loading ? (
        <>
          <div className="metrics-row">
            {METRIC_ORDER.map((key) => (
              <div className="mcard card" key={key}>
                <span className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
                <span className="skeleton" style={{ width: '62%', height: 26, marginTop: 18 }} />
                <span className="skeleton" style={{ width: '45%', height: 12, marginTop: 10 }} />
              </div>
            ))}
          </div>
          <div className="widgets-grid">
            {[0, 1, 2, 3].map((index) => (
              <div className="widget card" key={index}>
                <div className="widget__head">
                  <span className="skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <span className="skeleton" style={{ width: '45%', height: 13, display: 'block' }} />
                    <span className="skeleton" style={{ width: '30%', height: 10, display: 'block', marginTop: 6 }} />
                  </div>
                </div>
                <div className="widget__body">
                  <span className="skeleton" style={{ height: 148, borderRadius: 12, display: 'block' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {metricKeys.length > 0 && data && (
            <div className="metrics-row">
              {metricKeys.map((key) => (
                <MetricCard
                  key={key}
                  metricKey={key}
                  metric={data.metrics[key]}
                  currencySymbol={branding.currencySymbol}
                  decimalSeparator={branding.decimalSeparator}
                />
              ))}
            </div>
          )}

          {visibleWidgets.length === 0 ? (
            <div className="card dashboard-empty">
              <span className="dashboard-empty__icon">
                <LayoutGrid />
              </span>
              <b>Все виджеты скрыты</b>
              <p>Верните нужные блоки — цифры и заявки снова появятся на своих местах.</p>
              <button type="button" className="btn btn--primary" onClick={() => setCustomizeOpen(true)}>
                <SlidersHorizontal /> Настроить дашборд
              </button>
            </div>
          ) : (
            <div className="widgets-grid" data-dragging={drag ? true : undefined}>
              {renderList.map((item) =>
                item.type === 'placeholder' ? (
                  <div
                    className="widget-placeholder"
                    key="placeholder"
                    style={{ height: drag ? Math.max(160, drag.height) : undefined }}
                    aria-hidden
                  >
                    <span>Перетащите сюда</span>
                  </div>
                ) : (
                  <WidgetFrame
                    key={item.id}
                    id={item.id}
                    title={WIDGET_META[item.id].title}
                    subtitle={WIDGET_META[item.id].description}
                    icon={WIDGET_META[item.id].icon}
                    count={item.id === 'pending' ? data?.pending.length : undefined}
                    configurable={item.id !== 'calendar'}
                    canMoveUp={layout.widgets.findIndex((widget) => widget.id === item.id) > 0}
                    canMoveDown={
                      layout.widgets.findIndex((widget) => widget.id === item.id) < layout.widgets.length - 1
                    }
                    onMoveUp={() => moveWidget(item.id, -1)}
                    onMoveDown={() => moveWidget(item.id, 1)}
                    onHide={() => toggleWidget(item.id, false)}
                    onConfigure={() => setConfigWidget(item.id)}
                    onConfigureDashboard={() => setCustomizeOpen(true)}
                    onDragStart={(event, element) => start(event, item.id, element)}
                  >
                    {widgetBody(item.id, layout.widgets.find((widget) => widget.id === item.id)?.config || {})}
                  </WidgetFrame>
                )
              )}
            </div>
          )}
        </>
      )}

      <div className="dashboard-footer">
        <span>
          Обновлено {data ? formatTimeIn(data.generatedAt, branding.timezone) : '—'} · данные месяца{' '}
          {data ? formatDate(`${data.month}-01T12:00:00Z`, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''}
        </span>
      </div>

      <CustomizeDashboardModal
        open={customizeOpen}
        layout={layout}
        onClose={() => setCustomizeOpen(false)}
        onToggleMetric={toggleMetric}
        onToggleWidget={toggleWidget}
        onMoveWidget={moveWidget}
        onReset={resetLayout}
      />

      <WidgetConfigModal
        widgetId={configWidget}
        config={configWidget ? layout.widgets.find((widget) => widget.id === configWidget)?.config || {} : {}}
        onClose={() => setConfigWidget(null)}
        onToggle={toggleWidgetConfig}
      />

      <DeclineBookingModal
        booking={declineTarget}
        timezone={branding.timezone}
        busy={declining}
        onClose={() => setDeclineTarget(null)}
        onSubmit={(comment) => void declineBooking(comment)}
      />

      {drag &&
        createPortal(
          <div
            className="widget-ghost"
            style={{
              width: drag.width,
              height: Math.min(drag.height, 320),
              transform: `translate3d(${drag.x - drag.dx}px, ${drag.y - drag.dy}px, 0) scale(0.97)`
            }}
            aria-hidden
          >
            <div className="widget-ghost__head">
              {(() => {
                const Icon = WIDGET_META[drag.id].icon;
                return <Icon />;
              })()}
              <span>{WIDGET_META[drag.id].title}</span>
            </div>
            <div className="widget-ghost__body">
              <span />
              <span />
              <span />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
