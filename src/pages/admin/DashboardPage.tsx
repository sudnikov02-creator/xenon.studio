import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, RefreshCw, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/ui/PageHead';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import {
  DEFAULT_LAYOUT,
  METRIC_ORDER,
  WIDGET_META,
  normalizeLayout
} from '../../lib/dashboard';
import { formatDate, formatTimeIn, greeting } from '../../lib/utils';
import { useWidgetDrag } from '../../hooks/useWidgetDrag';
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
import type {
  BookingSummary,
  CalendarData,
  DashboardData,
  DashboardLayout,
  MetricKey,
  WidgetId
} from '../../types';

function MetricsSkeleton() {
  return (
    <div className="metrics-row" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <div className="mcard card" key={index}>
          <div className="mcard__top">
            <span className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            <span className="skeleton" style={{ width: 58, height: 22, borderRadius: 8 }} />
          </div>
          <span className="skeleton" style={{ width: '62%', height: 30, marginTop: 20 }} />
          <span className="skeleton" style={{ width: '48%', height: 11, marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

function WidgetsSkeleton() {
  return (
    <div className="widgets-grid" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <div className="widget card" key={index}>
          <div className="widget__head">
            <span className="skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
            <span className="skeleton" style={{ width: 160, height: 13 }} />
          </div>
          <div className="widget__body">
            <span className="skeleton" style={{ width: '100%', height: 52, borderRadius: 12 }} />
            <span className="skeleton" style={{ width: '100%', height: 52, borderRadius: 12, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { settings, branding, updateSettings } = useSettings();
  const { connected, subscribe, refreshBadges } = useRealtime();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declineTarget, setDeclineTarget] = useState<BookingSummary | null>(null);
  const [declineBusy, setDeclineBusy] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [configWidget, setConfigWidget] = useState<WidgetId | null>(null);
  const calendarMonthRef = useRef<string | null>(null);

  const layout = useMemo(() => normalizeLayout(settings?.dashboard), [settings?.dashboard]);
  const visibleWidgets = useMemo(() => layout.widgets.filter((widget) => widget.visible), [layout]);
  const visibleIds = useMemo(() => visibleWidgets.map((widget) => widget.id), [visibleWidgets]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get<DashboardData>('/dashboard');
      setData(response);
      if (!calendarMonthRef.current) setCalendar(response.calendar);
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить дашборд');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    return subscribe('booking', () => {
      void load(true);
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

  const toggleConfigField = (id: WidgetId, key: string, value: boolean) => {
    void persistLayout({
      ...layout,
      widgets: layout.widgets.map((widget) =>
        widget.id === id ? { ...widget, config: { ...widget.config, [key]: value } } : widget
      )
    });
  };

  const resetLayout = () => {
    void persistLayout(DEFAULT_LAYOUT);
    toast({ title: 'Дашборд настроен по умолчанию', variant: 'success' });
  };

  const { drag, placeholderIndex, startDrag } = useWidgetDrag({
    visibleIds,
    onReorder: (id, index) => {
      const rest = visibleIds.filter((widgetId) => widgetId !== id);
      rest.splice(Math.min(index, rest.length), 0, id);
      if (rest.join('|') === visibleIds.join('|')) return;
      const byId = new Map(layout.widgets.map((widget) => [widget.id, widget]));
      const hidden = layout.widgets.filter((widget) => !widget.visible);
      const widgets = [...rest.map((widgetId) => byId.get(widgetId)!).filter(Boolean), ...hidden];
      void persistLayout({ ...layout, widgets });
    }
  });

  const loadCalendarMonth = async (month: string) => {
    setCalendarLoading(true);
    try {
      const response = await api.get<CalendarData>(`/dashboard/calendar?month=${month}`);
      calendarMonthRef.current = month;
      setCalendar(response);
    } catch (err) {
      toast({
        title: 'Не удалось открыть месяц',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const acceptBooking = async (booking: BookingSummary) => {
    setBusyId(booking.id);
    try {
      await api.post(`/bookings/${booking.id}/accept`);
      void refreshBadges();
      toast({
        title: 'Заявка подтверждена',
        subtitle: `${booking.client?.name || 'Клиент'} · съёмка в расписании`,
        variant: 'success',
        action: { label: 'Открыть записи', onClick: () => navigate('/admin/bookings') }
      });
      await load(true);
    } catch (err) {
      toast({
        title: 'Не удалось подтвердить заявку',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      setBusyId(null);
    }
  };

  const declineBooking = async (comment: string) => {
    if (!declineTarget) return;
    setDeclineBusy(true);
    try {
      await api.post(`/bookings/${declineTarget.id}/decline`, { comment });
      void refreshBadges();
      toast({ title: 'Заявка отклонена', subtitle: 'Клиент увидит ваш комментарий', variant: 'info' });
      setDeclineTarget(null);
      await load(true);
    } catch (err) {
      toast({
        title: 'Не удалось отклонить заявку',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      setDeclineBusy(false);
    }
  };

  const firstName = (user?.name || branding.photographerName || '').split(' ')[0];
  const dateLabel = formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: branding.timezone
  });
  const showMetrics = METRIC_ORDER.filter((key) => layout.metrics[key]);
  const draggingId = drag?.moved ? drag.id : null;

  const renderList: ({ type: 'widget'; id: WidgetId } | { type: 'placeholder' })[] = [];
  visibleWidgets
    .filter((widget) => widget.id !== draggingId)
    .forEach((widget) => renderList.push({ type: 'widget', id: widget.id }));
  if (draggingId && placeholderIndex !== null) {
    renderList.splice(Math.min(placeholderIndex, renderList.length), 0, { type: 'placeholder' });
  }

  const pendingCount = data?.pending.length || 0;
  const ghostMeta = drag ? WIDGET_META[drag.id] : null;
  const GhostIcon = ghostMeta?.icon;

  const renderWidgetBody = (id: WidgetId, config: Record<string, boolean>) => {
    switch (id) {
      case 'today':
        return data ? (
          <TodayWidget bookings={data.todayBookings} next={data.next} config={config} />
        ) : (
          <div className="widget-loading">
            <span className="skeleton" style={{ height: 52, borderRadius: 12 }} />
            <span className="skeleton" style={{ height: 52, borderRadius: 12 }} />
          </div>
        );
      case 'pending':
        return data ? (
          <PendingWidget
            items={data.pending.slice(0, 5)}
            config={config}
            busyId={busyId}
            onAccept={acceptBooking}
            onDecline={setDeclineTarget}
          />
        ) : (
          <div className="widget-loading">
            <span className="skeleton" style={{ height: 62, borderRadius: 12 }} />
            <span className="skeleton" style={{ height: 62, borderRadius: 12 }} />
          </div>
        );
      case 'calendar':
        return (
          <MiniCalendarWidget calendar={calendar} loading={calendarLoading} onLoadMonth={loadCalendarMonth} />
        );
      case 'revenue':
        return <RevenueWidget revenue={data?.revenue || null} config={config} />;
      default:
        return null;
    }
  };

  return (
    <div className="page dashboard">
      <PageHead
        title={`${greeting()}, ${firstName}`}
        subtitle={`${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · ${branding.brandTagline}`}
        actions={
          <>
            <span className={`live-pill ${connected ? 'is-online' : ''}`}>
              {connected ? <Wifi /> : <WifiOff />}
              {connected ? 'На связи' : 'Подключение'}
            </span>
            <button type="button" className="btn" onClick={() => setCustomizeOpen(true)}>
              <SlidersHorizontal /> Настроить
            </button>
          </>
        }
      />

      {error && (
        <div className="card dashboard-error">
          <div>
            <b>Не удалось загрузить данные</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--soft" onClick={() => void load(false)}>
            <RefreshCw /> Повторить
          </button>
        </div>
      )}

      {loading ? (
        <>
          <MetricsSkeleton />
          <WidgetsSkeleton />
        </>
      ) : (
        <>
          {showMetrics.length > 0 && data && (
            <div className="metrics-row">
              {showMetrics.map((key) => (
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
              <span className="widget-empty__icon">
                <LayoutGrid />
              </span>
              <b>Все виджеты скрыты</b>
              <p>Верните нужные блоки — дашборд снова станет вашим рабочим столом.</p>
              <button type="button" className="btn btn--primary" onClick={() => setCustomizeOpen(true)}>
                <SlidersHorizontal /> Настроить дашборд
              </button>
            </div>
          ) : (
            <div className="widgets-grid" data-dragging={Boolean(draggingId) || undefined}>
              {renderList.map((entry) => {
                if (entry.type === 'placeholder') {
                  return (
                    <div
                      className="widget-placeholder"
                      key="widget-placeholder"
                      style={{ height: drag ? Math.min(drag.height, 460) : undefined }}
                    >
                      <span>Перетащите сюда</span>
                    </div>
                  );
                }
                const widget = layout.widgets.find((item) => item.id === entry.id);
                if (!widget) return null;
                const meta = WIDGET_META[widget.id];
                const index = layout.widgets.findIndex((item) => item.id === widget.id);
                return (
                  <WidgetFrame
                    key={widget.id}
                    id={widget.id}
                    title={meta.title}
                    subtitle={meta.description}
                    icon={meta.icon}
                    count={widget.id === 'pending' ? pendingCount : undefined}
                    configurable={widget.id !== 'calendar'}
                    canMoveUp={index > 0}
                    canMoveDown={index >= 0 && index < layout.widgets.length - 1}
                    onConfigure={() => setConfigWidget(widget.id)}
                    onHide={() => toggleWidget(widget.id, false)}
                    onMove={(direction) => moveWidget(widget.id, direction)}
                    onOpenDashboardSettings={() => setCustomizeOpen(true)}
                    onDragStart={(event, element) => startDrag(event, widget.id, element)}
                  >
                    {renderWidgetBody(widget.id, widget.config)}
                  </WidgetFrame>
                );
              })}
            </div>
          )}

          {data && (
            <div className="dashboard-footnote">
              <span>Обновлено в {formatTimeIn(data.generatedAt, branding.timezone)}</span>
              <span>·</span>
              <span>{pendingCount > 0 ? `${pendingCount} заявок ждут решения` : 'Все заявки обработаны'}</span>
            </div>
          )}
        </>
      )}

      <CustomizeDashboardModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        layout={layout}
        onToggleMetric={toggleMetric}
        onToggleWidget={toggleWidget}
        onMoveWidget={moveWidget}
        onReset={resetLayout}
      />

      <WidgetConfigModal
        widgetId={configWidget}
        layout={layout}
        onToggleField={toggleConfigField}
        onClose={() => setConfigWidget(null)}
      />

      <DeclineBookingModal
        booking={declineTarget}
        busy={declineBusy}
        onClose={() => setDeclineTarget(null)}
        onSubmit={declineBooking}
      />

      {drag?.moved &&
        ghostMeta &&
        createPortal(
          <div
            className="widget-ghost"
            style={{
              width: drag.width,
              height: Math.min(drag.height, 460),
              transform: `translate3d(${drag.x - drag.dx}px, ${drag.y - drag.dy}px, 0) scale(0.97)`
            }}
            aria-hidden="true"
          >
            <div className="widget-ghost__head">
              <span className="widget-ghost__icon">{GhostIcon && <GhostIcon />}</span>
              <span>{ghostMeta.title}</span>
            </div>
            <div className="widget-ghost__body">
              <span className="widget-ghost__line" style={{ width: '72%' }} />
              <span className="widget-ghost__line" style={{ width: '90%' }} />
              <span className="widget-ghost__line" style={{ width: '54%' }} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
