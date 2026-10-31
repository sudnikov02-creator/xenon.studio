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
  dashboard: { widgets: { id: string; visible: boolean }[] };
  [key: string]: unknown;
}

export interface AuthStatusResponse {
  hasAccount: boolean;
  authenticated: boolean;
  user: User | null;
  demoHint: { email: string; password: string } | null;
}
