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
  appleCalendar: { enabled: false, url: '' },
  vipDiscount: { enabled: false, percent: 10 },
  loyalty: { enabled: false, percent: 5, afterSessions: 3 },
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

export function logActivity({ type, title, description = null, entity = null, entityId = null, actor = 'photographer' }) {
  const info = db
    .prepare(
      `INSERT INTO activity_log (type, title, description, entity, entity_id, actor)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(type, title, description, entity, entityId, actor);
  return info.lastInsertRowid;
}
