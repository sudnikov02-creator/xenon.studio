export interface User {
  id: number;
  name: string;
  email: string;
  lastLoginAt?: string | null;
  createdAt?: string;
  /** Пароль неизвестен: студия восстановлена после перезапуска сервера. */
  needsPassword?: boolean;
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
  needsSetup?: boolean;
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
  loyalty?: {
    mode: 'bonus' | 'referral';
    bonusEnabled: boolean;
    redeemPercent: number;
    referralEnabled: boolean;
  };
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

/* ------------------------------ статусы ------------------------------ */

export interface StatusSettingsItem {
  id: number;
  name: string;
  color: string;
  order: number;
  isInitial: boolean;
  isFinal: boolean;
  isCancelled: boolean;
  clientCanReschedule: boolean;
  clientCanCancel: boolean;
  actions: { id: string; label: string; kind: string }[];
  bookings: number;
  upcoming: number;
  createdAt: string;
}

export interface StatusesSettingsPayload {
  statuses: StatusSettingsItem[];
  total: number;
  archived: number;
  initialId: number | null;
  cancelledId: number | null;
}

export interface StatusDraft {
  name: string;
  color: string;
  isInitial: boolean;
  isFinal: boolean;
  isCancelled: boolean;
  clientCanReschedule: boolean;
  clientCanCancel: boolean;
}

/* ------------------------------ клиенты ------------------------------ */

export type ClientSegment = 'all' | 'vip' | 'active' | 'new' | 'sleeping' | 'lead' | 'blacklist';
export type ClientBucket = Exclude<ClientSegment, 'all'> | 'regular';
export type ClientSort = 'recent' | 'created' | 'spent' | 'bookings' | 'name';

export interface ClientItem {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  instagram: string | null;
  notes: string | null;
  tags: string[];
  isVip: boolean;
  isBlacklisted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  bookings: number;
  spent: number;
  avgCheck: number;
  lastVisit: string | null;
  lastVisitDate: string | null;
  nextVisit: string | null;
  nextVisitDate: string | null;
  hasUpcoming: boolean;
  segment: ClientBucket;
}

export interface ClientListPayload {
  items: ClientItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  segment: string;
  sort: string;
  counts: Record<ClientSegment | 'regular', number>;
}

export interface ClientBookingRow {
  id: number;
  code: string;
  startsAt: string;
  localDate: string;
  duration: number;
  price: number;
  source: string;
  service: string;
  status: { name: string; color: string; isCancelled: boolean; isFinal: boolean } | null;
}

export interface ClientDetailPayload {
  client: ClientItem;
  bookings: ClientBookingRow[];
  stats: {
    total: number;
    cancelled: number;
    upcoming: number;
    firstVisit: string | null;
    services: string[];
  };
  loyalty?: { balance: number; refCode: string | null; invited: number; rewarded: number };
  today: string;
}

export interface ClientDraft {
  name: string;
  phone: string;
  email: string;
  telegram: string;
  instagram: string;
  notes: string;
  tags: string[];
}

/* ------------------------------ сообщения ------------------------------ */

export type MessageChannel = 'telegram' | 'email' | 'whatsapp' | 'sms';
export type MessageDirection = 'in' | 'out' | 'system';

export interface ChatMessage {
  id: number;
  direction: MessageDirection;
  kind: string;
  channel: MessageChannel;
  body: string;
  subject: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatClient {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  instagram: string | null;
  isVip: boolean;
  isBlacklisted: boolean;
}

export interface ConversationSummary {
  id: number;
  clientId: number;
  client: ChatClient;
  channel: MessageChannel;
  unread: number;
  total: number;
  hasBooking: boolean;
  lastMessage: Omit<ChatMessage, 'isRead'> | null;
  lastMessageAt: string | null;
}

export interface ConversationListPayload {
  items: ConversationSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  counts: { all: number; unread: number; unanswered: number };
  filter: string;
  today: string;
}

export interface ConversationDetailPayload {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  bookings: ClientBookingRow[];
  today: string;
}

export interface NotificationFeedPayload {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  filter: 'all' | 'unread';
  kind: string;
  counts: { all: number; unread: number; byKind: Record<string, number> };
  badges: Badges;
}

/* ------------------------------ маркетинг ------------------------------ */

export type DiscountKind = 'percent' | 'fixed';
export type DiscountStatus = 'active' | 'off' | 'scheduled' | 'expired';
export type DiscountAudience = 'all' | 'vip' | 'repeat' | 'new';

export interface DiscountItem {
  id: number;
  name: string;
  kind: DiscountKind;
  value: number;
  scope: 'all' | 'service' | 'package';
  itemIds: number[];
  minAmount: number;
  audience: DiscountAudience;
  auto: boolean;
  stackable: boolean;
  priority: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  usedCount: number;
  note: string | null;
  status: DiscountStatus;
  applied: number;
  coupons: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DiscountListPayload {
  items: DiscountItem[];
  counts: { all: number; active: number; off: number; saved: number };
}

export interface CouponItem {
  id: number;
  code: string;
  title: string | null;
  kind: DiscountKind;
  value: number;
  discountId: number | null;
  discountName: string | null;
  limitTotal: number;
  limitPerClient: number;
  usedCount: number;
  minAmount: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  note: string | null;
  status: 'active' | 'off' | 'expired' | 'exhausted' | 'scheduled';
  saved: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CouponListPayload {
  items: CouponItem[];
  counts: { all: number; active: number; used: number; exhausted: number };
  status: string;
  total: number;
}

export interface CertificateRedemption {
  id: number;
  amount: number;
  createdAt: string | null;
  code: string | null;
  startsAt: string | null;
}

export interface CertificateItem {
  id: number;
  code: string;
  kind: 'amount' | 'service';
  amount: number;
  remaining: number;
  spent: number;
  serviceId: number | null;
  serviceName: string | null;
  recipient: string | null;
  phone: string | null;
  email: string | null;
  clientId: number | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  status: 'active' | 'used' | 'expired' | 'blocked';
  note: string | null;
  history: CertificateRedemption[];
  createdAt: string | null;
}

export interface CertificateListPayload {
  items: CertificateItem[];
  counts: { all: number; active: number; used: number; expired: number; balance: number };
  status: string;
  total: number;
  today: string;
}

export interface MarketingOverview {
  month: string;
  saved: number;
  discounts: DiscountListPayload['counts'];
  coupons: CouponListPayload['counts'];
  certificates: CertificateListPayload['counts'];
  issued: number;
  topCoupons: { id: number; code: string; usedCount: number; saved: number }[];
}

export interface PriceQuote {
  item: { kind: 'service' | 'package'; id: number; name: string; price: number; duration: number } | null;
  lines: { id: string; name: string; qty: number; total: number }[];
  base: number;
  extras: number;
  subtotal: number;
  discount: { source: string; id: number | null; name: string; kind: DiscountKind; value: number; amount: number } | null;
  discountAlternatives: { source: string; id: number | null; name: string; amount: number }[];
  discountTotal: number;
  promo: {
    type: 'coupon' | 'certificate';
    id: number;
    code: string;
    label: string;
    kind?: DiscountKind;
    value?: number;
    amount: number;
  } | null;
  promoError: string | null;
  afterDiscount: number;
  afterPromo?: number;
  bonus?: { available: number; limit: number; applied: number; used: boolean };
  afterBonus?: number;
  total: number;
  today: string;
}

export type LoyaltyMode = 'bonus' | 'referral';

export interface LoyaltySettings {
  mode: LoyaltyMode;
  bonus: {
    enabled: boolean;
    percent: number;
    minSpend: number;
    maxPerBooking: number;
    welcome: number;
    expireDays: number;
    redeemPercent: number;
  };
  referral: {
    enabled: boolean;
    rewardInviter: number;
    rewardInvited: number;
    discountInvited: number;
    trigger: 'first_visit' | 'signup';
  };
}

export interface BonusClient {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  isVip: boolean;
  refCode: string | null;
  bookings: number;
  invited: number;
  balance: number;
}

export interface BonusTransaction {
  id: number;
  bookingId: number | null;
  kind: 'earn' | 'spend' | 'adjust' | 'referral' | string;
  amount: number;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface BonusHistory {
  client: { id: number; name: string; phone: string | null; refCode: string | null };
  balance: number;
  items: BonusTransaction[];
}

export interface ReferralItem {
  id: number;
  status: 'pending' | 'rewarded' | 'cancelled';
  code: string | null;
  inviter: { id: number; name: string; phone: string | null; refCode: string | null } | null;
  invited: { id: number | null; name: string; phone: string | null };
  bookingId: number | null;
  rewardInviter: number;
  rewardInvited: number;
  note: string | null;
  rewardedAt: string | null;
  createdAt: string;
  waitingDays: number;
}

export interface ReferralListPayload {
  items: ReferralItem[];
  counts: { all: number; pending: number; rewarded: number; cancelled: number };
  rewardTotal: number;
}

export interface LoyaltyOverview {
  mode: LoyaltyMode;
  settings: LoyaltySettings;
  today: string;
  bonus: {
    balance: number;
    issued: number;
    spent: number;
    monthIssued: number;
    accounts: number;
    active: number;
    average: number;
    pending: number;
  };
  referral: {
    all: number;
    pending: number;
    rewarded: number;
    cancelled: number;
    rewardTotal: number;
    share: number;
    pendingReward: number;
  };
  topClients: BonusClient[];
}

/* ------------------------------ шаблоны и автоматизация ------------------------------ */

export type TemplateChannel = 'telegram' | 'email' | 'push';

export interface NotificationTemplate {
  id: number;
  key: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export interface TemplateListPayload {
  items: NotificationTemplate[];
  variables: TemplateVariable[];
  channels: { id: 'telegram' | 'email'; label: string }[];
}

export type AutomationTrigger = 'booking_created' | 'status_changed' | 'before_shoot' | 'after_shoot' | 'no_visits';
export type AutomationAction = 'message' | 'notification' | 'status' | 'tag' | 'bonus';

export interface AutomationRule {
  id: number;
  name: string;
  trigger: AutomationTrigger;
  params: { hours?: number; days?: number; statusId?: number | null };
  conditions: { serviceId?: number | null; minAmount?: number; source?: 'client' | 'admin' | null; clientTag?: string | null };
  action: AutomationAction;
  actionParams: { templateKey?: string | null; channel?: 'telegram' | 'email' | null; statusId?: number | null; tag?: string; amount?: number; title?: string | null };
  isActive: boolean;
  runs: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface AutomationLogItem {
  id: number;
  automationId: number | null;
  automationName: string;
  bookingId: number | null;
  clientId: number | null;
  status: 'ok' | 'skipped' | string;
  message: string;
  createdAt: string;
}

export interface AutomationMeta {
  triggers: { id: AutomationTrigger; label: string; hint: string }[];
  actions: { id: AutomationAction; label: string; hint: string }[];
  templates: { id: number; key: string; name: string; channel: TemplateChannel }[];
  statuses: { id: number; name: string }[];
  services: { id: number; name: string }[];
}

export interface AutomationRulesPayload {
  items: AutomationRule[];
  log: AutomationLogItem[];
  meta: AutomationMeta;
}
