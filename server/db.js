import Database from 'better-sqlite3';
import { DEFAULT_SCHEDULE, normalizeSchedule } from './lib/schedule.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* Vercel (and any serverless host) exposes only /tmp as writable — the demo DB lives there
   and is re-seeded on every cold start. Locally the repo keeps ./data. */
const DEFAULT_DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'xenon-data')
  : path.resolve(__dirname, '..', 'data');
const DATA_DIR = process.env.XENON_DATA_DIR || DEFAULT_DATA_DIR;
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(process.env.XENON_DB || path.join(DATA_DIR, 'xenon.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip         TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  telegram_username TEXT,
  instagram         TEXT,
  notes             TEXT,
  tags              TEXT NOT NULL DEFAULT '[]',
  is_vip            INTEGER NOT NULL DEFAULT 0,
  is_blacklisted    INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  price       REAL NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 60,
  buffer_min  INTEGER NOT NULL DEFAULT 0,
  addons      TEXT NOT NULL DEFAULT '[]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS packages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  price       REAL NOT NULL DEFAULT 0,
  service_ids TEXT NOT NULL DEFAULT '[]',
  addons      TEXT NOT NULL DEFAULT '[]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS statuses (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  color                 TEXT NOT NULL DEFAULT '#2563eb',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_initial            INTEGER NOT NULL DEFAULT 0,
  is_final              INTEGER NOT NULL DEFAULT 0,
  is_cancelled          INTEGER NOT NULL DEFAULT 0,
  client_can_reschedule INTEGER NOT NULL DEFAULT 1,
  client_can_cancel     INTEGER NOT NULL DEFAULT 1,
  actions               TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at            TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  public_code  TEXT NOT NULL UNIQUE,
  client_id    INTEGER REFERENCES clients(id),
  service_id   INTEGER REFERENCES services(id),
  package_id   INTEGER REFERENCES packages(id),
  starts_at    TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  price        REAL NOT NULL DEFAULT 0,
  addons       TEXT NOT NULL DEFAULT '[]',
  status_id    INTEGER REFERENCES statuses(id),
  source       TEXT NOT NULL DEFAULT 'admin',
  notes        TEXT,
  client_note  TEXT,
  gallery_url  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS booking_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  meta       TEXT NOT NULL DEFAULT '{}',
  actor      TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  last_message_at TEXT,
  last_channel  TEXT NOT NULL DEFAULT 'telegram',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL DEFAULT 'out',
  kind            TEXT NOT NULL DEFAULT 'text',
  channel         TEXT NOT NULL DEFAULT 'telegram',
  body            TEXT NOT NULL DEFAULT '',
  subject         TEXT,
  is_read         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL DEFAULT 'info',
  title        TEXT NOT NULL,
  subtitle     TEXT,
  action_label TEXT,
  action_url   TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  entity      TEXT,
  entity_id   INTEGER,
  actor       TEXT NOT NULL DEFAULT 'photographer',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT 'photographer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phone_verifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  verified_at TEXT,
  used_at     TEXT,
  token       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'percent',
  value       REAL NOT NULL DEFAULT 0,
  scope       TEXT NOT NULL DEFAULT 'all',
  item_ids    TEXT NOT NULL DEFAULT '[]',
  min_amount  REAL NOT NULL DEFAULT 0,
  audience    TEXT NOT NULL DEFAULT 'all',
  auto        INTEGER NOT NULL DEFAULT 1,
  stackable   INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 0,
  starts_on   TEXT,
  ends_on     TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  used_count  INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS coupons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  title            TEXT,
  kind             TEXT NOT NULL DEFAULT 'percent',
  value            REAL NOT NULL DEFAULT 0,
  discount_id      INTEGER REFERENCES discounts(id) ON DELETE SET NULL,
  limit_total      INTEGER NOT NULL DEFAULT 0,
  limit_per_client INTEGER NOT NULL DEFAULT 1,
  used_count       INTEGER NOT NULL DEFAULT 0,
  min_amount       REAL NOT NULL DEFAULT 0,
  starts_on        TEXT,
  ends_on          TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id  INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  booking_id INTEGER,
  client_id  INTEGER,
  phone      TEXT,
  amount     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  kind         TEXT NOT NULL DEFAULT 'amount',
  amount       REAL NOT NULL DEFAULT 0,
  remaining    REAL NOT NULL DEFAULT 0,
  service_id   INTEGER REFERENCES services(id) ON DELETE SET NULL,
  recipient    TEXT,
  phone        TEXT,
  email        TEXT,
  client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  purchased_at TEXT,
  expires_at   TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS certificate_redemptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  booking_id     INTEGER,
  client_id      INTEGER,
  amount         REAL NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bonus_accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL UNIQUE REFERENCES clients(id),
  balance       INTEGER NOT NULL DEFAULT 0,
  total_earned  INTEGER NOT NULL DEFAULT 0,
  total_spent   INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bonus_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER NOT NULL REFERENCES clients(id),
  booking_id INTEGER,
  kind       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  reason     TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_client_id INTEGER NOT NULL REFERENCES clients(id),
  invited_client_id INTEGER,
  invited_name      TEXT,
  invited_phone     TEXT,
  code              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  booking_id        INTEGER,
  reward_inviter    INTEGER NOT NULL DEFAULT 0,
  reward_invited    INTEGER NOT NULL DEFAULT 0,
  rewarded_at       TEXT,
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'telegram',
  subject    TEXT,
  body       TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  is_system  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  trigger       TEXT NOT NULL,
  params        TEXT NOT NULL DEFAULT '{}',
  conditions    TEXT NOT NULL DEFAULT '{}',
  action        TEXT NOT NULL,
  action_params TEXT NOT NULL DEFAULT '{}',
  is_active     INTEGER NOT NULL DEFAULT 1,
  runs          INTEGER NOT NULL DEFAULT 0,
  last_run_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_marks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  entity        TEXT NOT NULL,
  entity_id     INTEGER NOT NULL,
  mark          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (automation_id, entity, entity_id, mark)
);

CREATE TABLE IF NOT EXISTS automation_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER,
  booking_id    INTEGER,
  client_id     INTEGER,
  status        TEXT NOT NULL DEFAULT 'ok',
  message       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS external_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL UNIQUE,
  title      TEXT,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL,
  all_day    INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'apple',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lookups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_bookings_starts ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_phone ON phone_verifications(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions ON coupon_redemptions(coupon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_tx_client ON bonus_transactions(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_log ON automation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_marks ON automation_marks(automation_id, entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_external_events ON external_events(starts_at);
`);

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

ensureColumn('statuses', 'is_cancelled', 'is_cancelled INTEGER NOT NULL DEFAULT 0');
/* Поля цены: сколько стоило по прайсу, сколько скинули и чем именно. */
ensureColumn('bookings', 'list_price', 'list_price REAL');
ensureColumn('bookings', 'discount_amount', 'discount_amount REAL NOT NULL DEFAULT 0');
ensureColumn('bookings', 'discount_id', 'discount_id INTEGER');
ensureColumn('bookings', 'coupon_id', 'coupon_id INTEGER');
ensureColumn('bookings', 'coupon_code', 'coupon_code TEXT');
ensureColumn('bookings', 'certificate_id', 'certificate_id INTEGER');
ensureColumn('bookings', 'certificate_code', 'certificate_code TEXT');
/* Бонусы и рефералы: сколько списали баллами, сколько начислили и по чьей ссылке пришёл клиент. */
ensureColumn('bookings', 'bonus_spent', 'bonus_spent INTEGER NOT NULL DEFAULT 0');
ensureColumn('bookings', 'bonus_earned', 'bonus_earned INTEGER NOT NULL DEFAULT 0');
ensureColumn('bookings', 'referral_code', 'referral_code TEXT');
ensureColumn('clients', 'ref_code', 'ref_code TEXT');

export const DEFAULT_SETTINGS = {
  siteName: 'xenon.studio',
  photographerName: 'Ксения Ветрова',
  brandTagline: 'Фотограф · естественный свет и живые эмоции',
  accentColor: '#2563eb',
  logoUrl: null,
  faviconUrl: null,
  timezone: 'Europe/Minsk',
  currencySymbol: '₽',
  currencyCode: 'RUB',
  decimalSeparator: 'comma',
  locale: 'ru',
  bookingHorizonDays: 90,
  minNoticeHours: 12,
  chatEnabled: true,
  landingEnabled: false,
  contacts: { phone: '', telegram: '', instagram: '', email: '' },
  verification: { enabled: false, telegram: true, email: false },
  agreement: { enabled: false, text: '', consentText: '' },
  seo: { title: 'xenon.studio — фотосессии', description: '', ogImage: null },
  appleCalendar: { enabled: false, url: '', exportToken: null, lastSyncAt: null, lastSyncCount: 0, lastSyncError: null },
  vipDiscount: { enabled: false, percent: 10 },
  loyalty: { enabled: false, percent: 5, afterSessions: 3 },
  marketing: {
    mode: 'bonus',
    bonus: {
      enabled: true,
      percent: 5,
      minSpend: 0,
      maxPerBooking: 3000,
      welcome: 500,
      expireDays: 365,
      redeemPercent: 30
    },
    referral: {
      enabled: true,
      rewardInviter: 1000,
      rewardInvited: 500,
      discountInvited: 500,
      trigger: 'first_visit'
    }
  },
  schedule: DEFAULT_SCHEDULE,
  bookingForm: {
    requireVerification: true,
    slotStepMin: 30,
    askNote: true,
    askInstagram: false,
    introText: ''
  },
  dashboard: {
    metrics: { bookings: true, revenue: true, avgCheck: true, clients: true },
    widgets: [
      { id: 'today', visible: true, config: { showPrice: true, showStatus: true } },
      { id: 'pending', visible: true, config: { showPrice: true } },
      { id: 'calendar', visible: true, config: {} },
      { id: 'revenue', visible: true, config: { compare: true } }
    ]
  },
  sidebarCollapsed: false
};

export function normalizeMarketing(value, fallback = DEFAULT_SETTINGS.marketing) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clamp = (input, min, max, def) => {
    const num = Number(input);
    if (!Number.isFinite(num)) return def;
    return Math.min(Math.max(num, min), max);
  };
  const mode = source.mode === 'referral' ? 'referral' : 'bonus';
  const bonus = { ...fallback.bonus, ...(source.bonus && typeof source.bonus === 'object' ? source.bonus : {}) };
  const referral = { ...fallback.referral, ...(source.referral && typeof source.referral === 'object' ? source.referral : {}) };
  return {
    mode,
    bonus: {
      enabled: bonus.enabled !== false,
      percent: clamp(bonus.percent, 0, 50, fallback.bonus.percent),
      minSpend: clamp(bonus.minSpend, 0, 1000000, fallback.bonus.minSpend),
      maxPerBooking: clamp(bonus.maxPerBooking, 0, 1000000, fallback.bonus.maxPerBooking),
      welcome: clamp(bonus.welcome, 0, 100000, fallback.bonus.welcome),
      expireDays: clamp(bonus.expireDays, 0, 3650, fallback.bonus.expireDays),
      redeemPercent: clamp(bonus.redeemPercent, 0, 100, fallback.bonus.redeemPercent)
    },
    referral: {
      enabled: referral.enabled !== false,
      rewardInviter: clamp(referral.rewardInviter, 0, 100000, fallback.referral.rewardInviter),
      rewardInvited: clamp(referral.rewardInvited, 0, 100000, fallback.referral.rewardInvited),
      discountInvited: clamp(referral.discountInvited, 0, 100000, fallback.referral.discountInvited),
      trigger: referral.trigger === 'signup' ? 'signup' : 'first_visit'
    }
  };
}

export function getSettings() {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  const stored = (() => {
    if (!row) return {};
    try {
      return JSON.parse(row.data) || {};
    } catch {
      return {};
    }
  })();
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  merged.schedule = normalizeSchedule(stored.schedule, DEFAULT_SCHEDULE);
  merged.marketing = normalizeMarketing(stored.marketing, DEFAULT_SETTINGS.marketing);
  return merged;
}

export function saveSettings(patch) {
  const current = getSettings();
  const merged = { ...current, ...patch };
  if (patch && patch.schedule !== undefined) {
    merged.schedule = normalizeSchedule(patch.schedule, current.schedule);
    merged.minNoticeHours = merged.schedule.minNoticeHours;
    merged.bookingHorizonDays = merged.schedule.horizonDays;
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(JSON.stringify(merged), now);
  return merged;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/* Журнал действий живёт в этом модуле, а SSE — в lib/sse.js (он сам импортирует db),
   поэтому обратный вызов подписывается снаружи: app.js регистрирует трансляцию события. */
let activitySubscriber = null;

export function onActivityLogged(listener) {
  activitySubscriber = listener;
}

export function logActivity({ type, title, description = null, entity = null, entityId = null, actor = 'photographer' }) {
  const info = db
    .prepare(
      `INSERT INTO activity_log (type, title, description, entity, entity_id, actor)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(type, title, description, entity, entityId, actor);
  if (activitySubscriber) {
    try {
      activitySubscriber({ action: 'logged', id: info.lastInsertRowid, type, actor });
    } catch {}
  }
  return info.lastInsertRowid;
}
