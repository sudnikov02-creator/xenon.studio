import {
  CalendarCheck2,
  CalendarDays,
  Clock3,
  CreditCard,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import type { DashboardLayout, MetricKey, WidgetId } from '../types';

export interface MetricMeta {
  label: string;
  icon: LucideIcon;
  tone: 'accent' | 'success' | 'violet' | 'warning';
  kind: 'count' | 'money';
}

export const METRIC_ORDER: MetricKey[] = ['bookings', 'revenue', 'avgCheck', 'clients'];

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  bookings: { label: 'Записи за месяц', icon: CalendarDays, tone: 'accent', kind: 'count' },
  revenue: { label: 'Доход за месяц', icon: Wallet, tone: 'success', kind: 'money' },
  avgCheck: { label: 'Средний чек', icon: CreditCard, tone: 'violet', kind: 'money' },
  clients: { label: 'Новые клиенты', icon: UserPlus, tone: 'warning', kind: 'count' }
};

export interface WidgetMeta {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  today: {
    title: 'Съёмки сегодня',
    description: 'Расписание текущего дня',
    icon: CalendarCheck2
  },
  pending: {
    title: 'Ожидают подтверждения',
    description: 'Заявки, которые ждут решения',
    icon: Clock3
  },
  calendar: {
    title: 'Календарь',
    description: 'Загрузка месяца и свободные дни',
    icon: CalendarDays
  },
  revenue: {
    title: 'Доход за месяц',
    description: 'Динамика по неделям',
    icon: TrendingUp
  }
};

export const WIDGET_CONFIG_FIELDS: Record<WidgetId, { key: string; label: string; hint?: string }[]> = {
  today: [
    { key: 'showPrice', label: 'Показывать стоимость' },
    { key: 'showStatus', label: 'Показывать статус' }
  ],
  pending: [{ key: 'showPrice', label: 'Показывать стоимость' }],
  calendar: [],
  revenue: [{ key: 'compare', label: 'Сравнивать с прошлым месяцем' }]
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

export function widgetHasConfig(id: WidgetId): boolean {
  return WIDGET_CONFIG_FIELDS[id].length > 0;
}

export function normalizeLayout(raw: unknown): DashboardLayout {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<DashboardLayout>;
  const metrics = { ...DEFAULT_LAYOUT.metrics };
  if (source.metrics && typeof source.metrics === 'object') {
    for (const key of METRIC_ORDER) {
      const value = (source.metrics as Record<string, unknown>)[key];
      if (typeof value === 'boolean') metrics[key] = value;
    }
  }

  const saved = Array.isArray(source.widgets) ? source.widgets : [];
  const normalized = DEFAULT_LAYOUT.widgets.map((definition) => {
    const match = saved.find((item) => item && (item as { id?: string }).id === definition.id) as
      | { visible?: unknown; config?: unknown }
      | undefined;
    const rawConfig = match?.config && typeof match.config === 'object' ? match.config : {};
    const config: Record<string, boolean> = { ...definition.config };
    for (const field of WIDGET_CONFIG_FIELDS[definition.id]) {
      const value = (rawConfig as Record<string, unknown>)[field.key];
      if (typeof value === 'boolean') config[field.key] = value;
    }
    return {
      id: definition.id,
      visible: match && typeof match.visible === 'boolean' ? match.visible : definition.visible,
      config
    };
  });

  const ordered: typeof normalized = [];
  for (const entry of saved) {
    const id = (entry as { id?: string })?.id as WidgetId | undefined;
    if (!id) continue;
    const widget = normalized.find((item) => item.id === id);
    if (widget && !ordered.some((item) => item.id === id)) ordered.push(widget);
  }
  for (const widget of normalized) {
    if (!ordered.some((item) => item.id === widget.id)) ordered.push(widget);
  }

  return { metrics, widgets: ordered };
}

export function widgetConfig(layout: DashboardLayout, id: WidgetId, key: string): boolean {
  return layout.widgets.find((widget) => widget.id === id)?.config[key] !== false;
}
