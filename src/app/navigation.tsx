import {
  BadgePercent,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartNoAxesColumn,
  ClipboardList,
  FileText,
  Gift,
  Globe,
  Handshake,
  Languages,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  MessageSquareText,
  Palette,
  Plug,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  User,
  Users,
  Zap,
  type LucideIcon
} from 'lucide-react';

export interface NavChild {
  key: string;
  label: string;
  path: string;
}

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: 'messages';
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Дашборд', path: '/admin', icon: LayoutDashboard },
  { key: 'bookings', label: 'Записи', path: '/admin/bookings', icon: CalendarDays },
  { key: 'calendar', label: 'Календарь', path: '/admin/calendar', icon: CalendarRange },
  { key: 'clients', label: 'Клиенты', path: '/admin/clients', icon: Users },
  { key: 'messages', label: 'Сообщения', path: '/admin/messages', icon: MessageSquare, badge: 'messages' },
  { key: 'services', label: 'Услуги и пакеты', path: '/admin/services', icon: Sparkles },
  {
    key: 'marketing',
    label: 'Маркетинг',
    icon: Megaphone,
    children: [
      { key: 'discounts', label: 'Скидки', path: '/admin/marketing/discounts' },
      { key: 'coupons', label: 'Купоны', path: '/admin/marketing/coupons' },
      { key: 'certificates', label: 'Сертификаты', path: '/admin/marketing/certificates' },
      { key: 'bonuses', label: 'Бонусы / Рефералы', path: '/admin/marketing/bonuses' }
    ]
  },
  { key: 'reviews', label: 'Отзывы', path: '/admin/reviews', icon: Star },
  { key: 'analytics', label: 'Аналитика', path: '/admin/analytics', icon: ChartNoAxesColumn },
  { key: 'activity', label: 'Журнал действий', path: '/admin/activity', icon: ScrollText },
  { key: 'landing', label: 'Мини-лендинг', path: '/admin/landing', icon: Globe },
  {
    key: 'settings',
    label: 'Настройки',
    icon: Settings,
    children: [
      { key: 'profile', label: 'Профиль', path: '/admin/settings/profile' },
      { key: 'schedule', label: 'Расписание', path: '/admin/settings/schedule' },
      { key: 'booking-form', label: 'Форма записи', path: '/admin/settings/booking-form' },
      { key: 'statuses', label: 'Статусы', path: '/admin/settings/statuses' },
      { key: 'notifications', label: 'Уведомления и шаблоны', path: '/admin/settings/notifications' },
      { key: 'currency', label: 'Валюта и локализация', path: '/admin/settings/currency' },
      { key: 'automation', label: 'Автоматизация', path: '/admin/settings/automation' },
      { key: 'agreement', label: 'Договор / соглашение', path: '/admin/settings/agreement' },
      { key: 'seo', label: 'SEO', path: '/admin/settings/seo' },
      { key: 'appearance', label: 'Внешний вид', path: '/admin/settings/appearance' },
      { key: 'integrations', label: 'Интеграции', path: '/admin/settings/integrations' },
      { key: 'verification', label: 'Верификация клиентов', path: '/admin/settings/verification' },
      { key: 'messages', label: 'Сообщения', path: '/admin/settings/messages' }
    ]
  }
];

export const MARKETING_ICONS: Record<string, LucideIcon> = {
  discounts: BadgePercent,
  coupons: Ticket,
  certificates: Gift,
  bonuses: Handshake
};

export const SETTINGS_ICONS: Record<string, LucideIcon> = {
  profile: User,
  schedule: CalendarClock,
  'booking-form': ClipboardList,
  statuses: ListChecks,
  notifications: BellRing,
  currency: Languages,
  automation: Zap,
  agreement: FileText,
  seo: Search,
  appearance: Palette,
  integrations: Plug,
  verification: ShieldCheck,
  messages: MessageSquareText
};

export const MOBILE_PRIMARY = ['dashboard', 'bookings', 'messages', 'clients'];

export function findNavItem(key: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.key === key);
}

export interface RouteMeta {
  title: string;
  group?: string;
  parent?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/admin': { title: 'Дашборд' },
  '/admin/bookings': { title: 'Записи' },
  '/admin/calendar': { title: 'Календарь' },
  '/admin/clients': { title: 'Клиенты' },
  '/admin/messages': { title: 'Сообщения' },
  '/admin/services': { title: 'Услуги и пакеты' },
  '/admin/reviews': { title: 'Отзывы' },
  '/admin/analytics': { title: 'Аналитика' },
  '/admin/activity': { title: 'Журнал действий' },
  '/admin/landing': { title: 'Мини-лендинг' },
  '/admin/marketing': { title: 'Маркетинг', group: 'Маркетинг' },
  '/admin/marketing/discounts': { title: 'Скидки', group: 'Маркетинг' },
  '/admin/marketing/coupons': { title: 'Купоны', group: 'Маркетинг' },
  '/admin/marketing/certificates': { title: 'Сертификаты', group: 'Маркетинг' },
  '/admin/marketing/bonuses': { title: 'Бонусы / Рефералы', group: 'Маркетинг' },
  '/admin/settings': { title: 'Настройки', group: 'Настройки' },
  '/admin/settings/profile': { title: 'Профиль', group: 'Настройки' },
  '/admin/settings/schedule': { title: 'Расписание', group: 'Настройки' },
  '/admin/settings/booking-form': { title: 'Форма записи', group: 'Настройки' },
  '/admin/settings/statuses': { title: 'Статусы', group: 'Настройки' },
  '/admin/settings/notifications': { title: 'Уведомления и шаблоны', group: 'Настройки' },
  '/admin/settings/currency': { title: 'Валюта и локализация', group: 'Настройки' },
  '/admin/settings/automation': { title: 'Автоматизация', group: 'Настройки' },
  '/admin/settings/agreement': { title: 'Договор / соглашение', group: 'Настройки' },
  '/admin/settings/seo': { title: 'SEO', group: 'Настройки' },
  '/admin/settings/appearance': { title: 'Внешний вид', group: 'Настройки' },
  '/admin/settings/integrations': { title: 'Интеграции', group: 'Настройки' },
  '/admin/settings/verification': { title: 'Верификация клиентов', group: 'Настройки' },
  '/admin/settings/messages': { title: 'Сообщения', group: 'Настройки' }
};
