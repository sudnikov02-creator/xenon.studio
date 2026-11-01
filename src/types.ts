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

export interface StudioContacts {
  phone: string;
  telegram: string;
  instagram: string;
  email: string;
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
  contacts: StudioContacts;
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
  schedule: Schedule;
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


/* ------------------------------- services ------------------------------- */

export type AddonType = 'toggle' | 'quantity';

export interface ServiceAddon {
  id: string;
  name: string;
  type: AddonType;
  price: number;
  unit?: string;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  buffer: number;
  addons: ServiceAddon[];
  isActive: boolean;
  sortOrder: number;
  bookings: number;
  createdAt?: string;
}

export interface ServicePackage {
  id: number;
  name: string;
  description: string;
  price: number;
  serviceIds: number[];
  addons: ServiceAddon[];
  isActive: boolean;
  sortOrder: number;
  bookings: number;
  createdAt?: string;
}

export interface ServiceDraft {
  name: string;
  description: string;
  price: number;
  duration: number;
  buffer: number;
  addons: ServiceAddon[];
  isActive: boolean;
}

export interface PackageDraft {
  name: string;
  description: string;
  price: number;
  serviceIds: number[];
  addons: ServiceAddon[];
  isActive: boolean;
}

export interface ServicesPayload {
  services: Service[];
  packages: ServicePackage[];
}

/* ------------------------------- schedule ------------------------------- */

export interface ScheduleDay {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface ScheduleException {
  date: string;
  closed: boolean;
  start: string | null;
  end: string | null;
  note: string | null;
}

export interface Schedule {
  accepting: boolean;
  week: ScheduleDay[];
  bufferMin: number;
  minNoticeHours: number;
  horizonDays: number;
  exceptions: ScheduleException[];
}

/* ------------------------------- booking form ------------------------------- */

export interface BookingFormSchedule {
  accepting: boolean;
  minNoticeHours: number;
  horizonDays: number;
  bufferMin: number;
  week: { day: number; enabled: boolean; start: string; end: string }[];
  exceptions: { date: string; closed: boolean; start: string | null; end: string | null; note: string | null }[];
}

export interface BookingFormOptions {
  services: Service[];
  packages: ServicePackage[];
  today: string;
  month: string;
  schedule: BookingFormSchedule;
  form: {
    requireVerification: boolean;
    slotStepMin: number;
    askNote: boolean;
    askInstagram: boolean;
    introText: string;
  };
  agreement: { enabled: boolean; text: string; consentText: string };
  branding: {
    siteName: string;
    photographerName: string;
    timezone: string;
    currencySymbol: string;
    decimalSeparator: 'comma' | 'dot';
  };
}

export interface AvailabilityDay {
  count: number;
  first: string;
  last: string;
}

export interface AvailabilityResponse {
  month: string;
  days: Record<string, AvailabilityDay>;
  firstFree: string | null;
  today: string;
  accepting: boolean;
}

export interface BookingSlot {
  time: string;
  iso: string;
}

export interface SlotsResponse {
  date: string;
  duration: number;
  slots: BookingSlot[];
  accepting: boolean;
  minNoticeHours: number;
}

export interface BookingDraft {
  serviceId: number | null;
  packageId: number | null;
  date: string;
  time: string;
  addons: Record<string, number>;
  name: string;
  phone: string;
  email: string;
  instagram: string;
  note: string;
  agreed: boolean;
}

export interface CreatedBooking {
  booking: BookingSummary;
  clientId: number;
  message: string;
  localDate: string;
}

/* ------------------------------- bookings ------------------------------- */

export interface BookingStatusInfo {
  id: number;
  name: string;
  color: string;
  order: number;
  isInitial: boolean;
  isFinal: boolean;
  isCancelled: boolean;
  count: number;
}

export interface BookingStatusesPayload {
  statuses: BookingStatusInfo[];
  total: number;
  today: string;
  todayCount: number;
}

export interface BookingListPayload {
  items: BookingSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  status: string;
  period: string;
  range: { start: string | null; end: string | null };
}

export interface BookingEventItem {
  id: number;
  type: string;
  title: string;
  message: string | null;
  actor: string;
  createdAt: string;
}

export interface BookingClientDetail {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  instagram: string | null;
  isVip: boolean;
  notes: string | null;
}

export interface BookingDetail {
  booking: BookingSummary;
  source: string;
  clientNote: string | null;
  client: BookingClientDetail | null;
  service: { id: number; name: string; description: string | null } | null;
  package: { id: number; name: string; services: { name: string; duration: number }[] } | null;
  events: BookingEventItem[];
}

export interface BookingSlotsPayload {
  date: string;
  duration: number;
  current: string;
  currentLocal: string;
  slots: { time: string; iso: string }[];
}

export interface BookingMonthPayload {
  month: string;
  days: Record<string, { count: number; first: string; last: string }>;
  today: string;
}

export type BookingPeriod = 'all' | 'today' | 'week' | 'month' | 'upcoming' | 'past';

/* ---------------------- клиентская страница записи ---------------------- */

export interface ClientBookingStatus {
  name: string;
  color: string;
  isFinal: boolean;
  isCancelled: boolean;
  order: number;
}

export interface ClientBookingPermissions {
  canReschedule: boolean;
  canCancel: boolean;
  rescheduleReason: string | null;
  cancelReason: string | null;
  hoursLeft: number;
  minNoticeHours: number;
  lateCancel: boolean;
}

export interface ClientBookingStudio {
  siteName: string;
  photographerName: string;
  brandTagline: string;
  logoUrl: string | null;
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  contacts: { phone: string; telegram: string; instagram: string; email: string };
}

export interface ClientBookingView {
  code: string;
  today: string;
  booking: {
    code: string;
    startsAt: string;
    localDate: string;
    localTime: string;
    duration: number;
    price: number;
    addons: { id: string; name: string; price: number; type?: string; qty?: number }[];
    clientNote: string | null;
    galleryUrl: string | null;
    createdAt: string | null;
  };
  client: { name: string; phone: string | null; instagram: string | null };
  status: ClientBookingStatus | null;
  service: { name: string; description: string | null } | null;
  package: { name: string; services: { name: string; duration: number }[] } | null;
  events: BookingEventItem[];
  permissions: ClientBookingPermissions;
  studio: ClientBookingStudio;
  agreement: { enabled: boolean; text: string };
  schedule: { minNoticeHours: number; horizonDays: number; accepting: boolean; stepMin: number };
}

export interface ClientMonthPayload {
  month: string;
  days: Record<string, { count: number; first: string; last: string }>;
  today: string;
}

export interface ClientSlotsPayload {
  date: string;
  slots: { time: string; iso: string }[];
  duration: number;
  current: string;
  currentLocal: string;
}
