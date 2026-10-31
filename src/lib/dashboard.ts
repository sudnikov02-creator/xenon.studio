import {
  CalendarCheck2,
  CalendarDays,
  ChartColumn,
  CreditCard,
  GripVertical,
  Inbox,
  LayoutGrid,
  SlidersHorizontal,
  TrendingUp,
  UserPlus,
  type LucideIcon
} from 'lucide-react';
import type { DashboardLayout, MetricKey, WidgetId } from '../types';

export type MetricTone = 'accent' | 'success' | 'violet' | 'warning';

export const METRIC_META: Record<
  MetricKey,
  { label: string; icon: LucideIcon; tone: MetricTone; kind: 'count' | 'money' }
> = {
  bookings: { label: 'Записи за месяц', icon: CalendarDays, tone: 'accent', kind: 'count' },
  revenue: { label: 'Доход за месяц', icon: TrendingUp, tone: 'success', kind: 'money' },
  avgCheck: { label: 'Средний чек', icon: CreditCard, tone: 'violet', kind: 'money' },
  clients: { label: 'Новые клиенты', icon: UserPlus, tone: 'warning', kind: 'count' }
};

export const METRIC_ORDER: MetricKey[] = ['bookings', 'revenue', 'avgCheck', 'clients'];

export const WIDGET_META: Record<WidgetId, { title: string; description: string; icon: LucideIcon }> = {
  today: {
    title: 'Съёмки сегодня',
    description: 'Расписание дня и ближайшая запись',
    icon: CalendarCheck2
  },
  pending: {
    title: 'Заявки в ожидании',
    description: 'Подтвердите или отклоните запись',
    icon: Inbox
  },
  calendar: {
    title: 'Календарь',
    description: 'Загрузка месяца и свободные дни',
    icon: CalendarDays
  },
  revenue: {
    title: 'Доход по неделям',
    description: 'Сравнение с прошлым месяцем',
    icon: ChartColumn
  }
};

export const WIDGET_CONFIG_FIELDS: Record<WidgetId, { key: string; label: string; hint: string }[]> = {
  today: [
    { key: 'showPrice', label: 'Показывать стоимость', hint: 'Цена каждой съёмки в строке расписания' },
    { key: 'showStatus', label: 'Показывать статус', hint: 'Цветной бейдж со статусом записи' }
  ],
  pending: [{ key: 'showPrice', label: 'Показывать стоимость', hint: 'Цена будущей съёмки в заявке' }],
  calendar: [],
  revenue: [
    { key: 'compare', label: 'Сравнение с прошлым месяцем', hint: 'Второй столбик в каждой неделе' }
  ]
};

export const DEFAULT_LAYOUT: DashboardLayout = {
  metrics: { bookings: true, revenue: true, avgCheck: true, clients: true },
  widgets: [
    { id: 'today', visible: true, config: { showPrice: true, showStatus: true } },
    { id: 'pending', visible: true, config: { showPrice: true } },
    { id: 'calendar', visible: true, config: {} },
    { id: 'revenue', visible: true, config: { compare: true } }
  ]
};

const WIDGET_FALLBACK: Record<WidgetId, Record<string, boolean>> = {
  today: { showPrice: true, showStatus: true },
  pending: { showPrice: true },
  calendar: {},
  revenue: { compare: true }
};

export function normalizeLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== 'object') return DEFAULT_LAYOUT;
  const source = raw as Partial<DashboardLayout>;
  const metrics = { ...DEFAULT_LAYOUT.metrics };
  if (source.metrics) {
    for (const key of METRIC_ORDER) {
      if (typeof source.metrics[key] === 'boolean') metrics[key] = source.metrics[key];
    }
  }
  const seen = new Set<WidgetId>();
  const widgets = (Array.isArray(source.widgets) ? source.widgets : [])
    .filter((item): item is DashboardLayout['widgets'][number] => Boolean(item) && item.id in WIDGET_META)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item) => ({
      id: item.id,
      visible: item.visible !== false,
      config: { ...WIDGET_FALLBACK[item.id], ...(item.config || {}) }
    }));
  for (const id of Object.keys(WIDGET_META) as WidgetId[]) {
    if (!seen.has(id)) {
      widgets.push({ id, visible: true, config: { ...WIDGET_FALLBACK[id] } });
    }
  }
  return { metrics, widgets };
}

export function widgetConfig(layout: DashboardLayout, id: WidgetId): Record<string, boolean> {
  return layout.widgets.find((widget) => widget.id === id)?.config || { ...WIDGET_FALLBACK[id] };
}

export const DRAG_HINT_ICON = GripVertical;
export const SETTINGS_ICON = SlidersHorizontal;
export const LAYOUT_ICON = LayoutGrid;
