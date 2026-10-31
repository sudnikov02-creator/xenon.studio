export interface User {
  id: number;
  name: string;
  email: string;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Badges {
  unreadNotifications: number;
  unreadMessages: number;
  pendingBookings: number;
}

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  subtitle: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  isRead: number;
  createdAt: string;
}

export interface Branding {
  siteName: string;
  photographerName: string;
  brandTagline: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  timezone: string;
  currencySymbol: string;
  currencyCode: string;
  decimalSeparator: 'comma' | 'dot';
  locale: string;
  landingEnabled: boolean;
  seo: { title: string; description: string; ogImage: string | null };
}

export interface StudioSettings extends Branding {
  bookingHorizonDays: number;
  minNoticeHours: number;
  chatEnabled: boolean;
  verification: { enabled: boolean; telegram: boolean; email: boolean };
  agreement: { enabled: boolean; text: string; consentText: string };
  appleCalendar: { enabled: boolean; url: string };
  vipDiscount: { enabled: boolean; percent: number };
  loyalty: { enabled: boolean; percent: number; afterSessions: number };
  dashboard: DashboardLayout;
  [key: string]: unknown;
}

export interface AuthStatusResponse {
  hasAccount: boolean;
  authenticated: boolean;
  user: User | null;
  demoHint: { email: string; password: string } | null;
}

export interface BookingClient {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  instagram: string | null;
}

export interface BookingStatus {
  id: number;
  name: string;
  color: string;
  isInitial: boolean;
  isFinal: boolean;
  isCancelled: boolean;
  order: number;
}

export interface BookingSummary {
  id: number;
  code: string;
  startsAt: string;
  localDate: string;
  duration: number;
  price: number;
  addons: { id: string; name: string; price: number; type?: string; qty?: number }[];
  notes: string | null;
  galleryUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client: BookingClient | null;
  service: { id: number; name: string } | null;
  package: { id: number; name: string } | null;
  status: BookingStatus | null;
}

export interface MetricValue {
  value: number;
  previous: number;
  delta: number;
}

export interface CalendarDay {
  count: number;
  pending: number;
}

export interface CalendarItem {
  id: number;
  localDate: string;
  startsAt: string;
  clientName: string;
  statusName: string;
  statusColor: string;
  isInitial: boolean;
  price: number;
}

export interface CalendarData {
  month: string;
  today: string;
  days: Record<string, CalendarDay>;
  items: CalendarItem[];
}

export interface RevenueWeek {
  label: string;
  current: number;
  previous: number;
}

export interface RevenueData {
  month: string;
  weeks: RevenueWeek[];
  total: number;
  previousTotal: number;
  bookingCount: number;
}

export interface DashboardData {
  month: string;
  today: string;
  metrics: {
    bookings: MetricValue;
    revenue: MetricValue;
    avgCheck: MetricValue;
    clients: MetricValue;
  };
  todayBookings: BookingSummary[];
  pending: BookingSummary[];
  next: BookingSummary | null;
  calendar: CalendarData;
  revenue: RevenueData;
  generatedAt: string;
}

export type MetricKey = 'bookings' | 'revenue' | 'avgCheck' | 'clients';

export type WidgetId = 'today' | 'pending' | 'calendar' | 'revenue';

export interface DashboardWidgetLayout {
  id: WidgetId;
  visible: boolean;
  config: Record<string, boolean>;
}

export interface DashboardLayout {
  metrics: Record<MetricKey, boolean>;
  widgets: DashboardWidgetLayout[];
}
