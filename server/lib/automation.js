import { db, logActivity } from '../db.js';
import { ensureConversation, sendMessage } from './messaging.js';
import { onBookingCompleted } from './loyalty.js';

/**
 * Шаблоны сообщений и автоматизация.
 *
 * Событийные сценарии (заявка, смена статуса) запускаются сразу из роутов,
 * а сценарии по времени (напоминание до съёмки, письмо после, возврат клиента)
 * проверяются планировщиком. Каждый прогон фиксируется, поэтому одно и то же
 * сообщение не уходит клиенту дважды.
 */

const MAX_NAME = 90;
const MAX_BODY = 2000;
const MAX_SUBJECT = 120;

export const CHANNELS = ['telegram', 'email', 'push'];

export const TRIGGERS = {
  booking_created: { label: 'Новая заявка', hint: 'Сразу после записи клиентом' },
  status_changed: { label: 'Смена статуса', hint: 'Когда запись переходит в выбранный статус' },
  before_shoot: { label: 'До съёмки', hint: 'За указанное число часов до начала' },
  after_shoot: { label: 'После съёмки', hint: 'Через несколько дней после съёмки' },
  no_visits: { label: 'Клиент пропал', hint: 'Если не было съёмок дольше указанного срока' }
};

export const ACTIONS = {
  message: { label: 'Написать клиенту', hint: 'Отправить шаблон в Telegram или на почту' },
  notification: { label: 'Уведомить фотографа', hint: 'Внутреннее уведомление в панели' },
  status: { label: 'Сменить статус', hint: 'Перевести запись в другой статус' },
  tag: { label: 'Добавить метку', hint: 'Отметить клиента в базе' },
  bonus: { label: 'Начислить баллы', hint: 'Зачислить баллы на бонусный счёт' }
};

export const VARIABLES = [
  { key: 'client_name', label: 'Имя клиента', sample: 'Анна' },
  { key: 'date', label: 'Дата съёмки', sample: '14 мая' },
  { key: 'time', label: 'Время', sample: '15:30' },
  { key: 'service', label: 'Услуга', sample: 'Портретная съёмка' },
  { key: 'price', label: 'Стоимость', sample: '9 000 ₽' },
  { key: 'duration', label: 'Длительность', sample: '120 минут' },
  { key: 'code', label: 'Код записи', sample: 'Hk3pQz7Lm2A' },
  { key: 'link', label: 'Ссылка на запись', sample: 'https://studio/b/Hk3pQz7Lm2A' },
  { key: 'studio', label: 'Название студии', sample: 'xenon.studio' },
  { key: 'photographer', label: 'Фотограф', sample: 'Ксения Ветрова' }
];

export const DEFAULT_TEMPLATES = [
  {
    key: 'booking_created',
    name: 'Заявка получена',
    channel: 'telegram',
    sort: 10,
    body:
      '{{client_name}}, спасибо за заявку!\n{{service}} — {{date}} в {{time}}, стоимость {{price}}.\nПодтвержу запись в ближайшее время. {{photographer}}'
  },
  {
    key: 'booking_confirmed',
    name: 'Запись подтверждена',
    channel: 'telegram',
    sort: 20,
    body:
      '{{client_name}}, запись подтверждена: {{date}} в {{time}}, {{service}}.\nПодробности и перенос — по ссылке: {{link}}'
  },
  {
    key: 'booking_reminder',
    name: 'Напоминание о съёмке',
    channel: 'telegram',
    sort: 30,
    body: '{{client_name}}, напоминаю о съёмке «{{service}}» — {{date}} в {{time}}. Если планы изменились, напишите мне.'
  },
  {
    key: 'booking_done',
    name: 'Спасибо за съёмку',
    channel: 'telegram',
    sort: 40,
    body: '{{client_name}}, спасибо за съёмку! Готовые кадры пришлю в течение 14 дней. Ссылка на запись: {{link}}'
  },
  {
    key: 'gallery_ready',
    name: 'Галерея готова',
    channel: 'email',
    sort: 50,
    subject: 'Ваши фотографии готовы',
    body: '{{client_name}}, здравствуйте!\n\nГалерея с вашей съёмки готова: {{link}}\n\nСпасибо, что выбрали {{studio}}.'
  },
  {
    key: 'review_request',
    name: 'Запрос отзыва',
    channel: 'telegram',
    sort: 60,
    body: '{{client_name}}, если вам понравилась съёмка, буду благодарна за короткий отзыв. Это очень помогает студии.'
  },
  {
    key: 'winback',
    name: 'Возврат клиента',
    channel: 'telegram',
    sort: 70,
    body: '{{client_name}}, давно не виделись! Запишитесь на съёмку — для вас действует скидка постоянного клиента.'
  }
];

function round(value) {
  return Math.round(Number(value) || 0);
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function dayKey(value = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function fail(status, error, message, field) {
  return { status, body: { error, message, ...(field ? { field } : {}) } };
}

/* ------------------------------ шаблоны ------------------------------ */

export function ensureTemplates() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO notification_templates (key, name, channel, subject, body, is_active, is_system, sort_order)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
  );
  for (const item of DEFAULT_TEMPLATES) {
    insert.run(item.key, item.name, item.channel, item.subject || null, item.body, item.sort);
  }
}

function mapTemplate(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    channel: CHANNELS.includes(row.channel) ? row.channel : 'telegram',
    subject: row.subject,
    body: row.body,
    isActive: Boolean(row.is_active),
    isSystem: Boolean(row.is_system),
    sortOrder: row.sort_order,
    updatedAt: row.updated_at
  };
}

export function listTemplates() {
  return {
    items: db.prepare('SELECT * FROM notification_templates ORDER BY sort_order, id').all().map(mapTemplate),
    variables: VARIABLES,
    channels: [
      { id: 'telegram', label: 'Telegram' },
      { id: 'email', label: 'Почта' }
    ]
  };
}

function cleanTemplateBody(value) {
  return String(value || '').replace(/\r\n/g, '\n').slice(0, MAX_BODY);
}

export function createTemplate(body = {}) {
  const name = String(body.name || '').trim();
  if (name.length < 2) return fail(422, 'invalid_name', 'Укажите название шаблона', 'name');
  const text = cleanTemplateBody(body.body).trim();
  if (text.length < 5) return fail(422, 'invalid_body', 'Текст шаблона слишком короткий', 'body');
  const key = `custom_${Date.now().toString(36)}`;
  const info = db
    .prepare(
      `INSERT INTO notification_templates (key, name, channel, subject, body, is_active, is_system, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      key,
      name.slice(0, MAX_NAME),
      CHANNELS.includes(body.channel) ? body.channel : 'telegram',
      String(body.subject || '').slice(0, MAX_SUBJECT) || null,
      text,
      body.isActive === false ? 0 : 1,
      900
    );
  logActivity({ type: 'settings', title: 'Создан шаблон сообщения', description: name, entity: 'template', entityId: Number(info.lastInsertRowid) });
  return { status: 201, body: { template: mapTemplate(db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(info.lastInsertRowid)) } };
}

export function updateTemplate(id, body = {}) {
  const row = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(Number(id));
  if (!row) return fail(404, 'not_found', 'Шаблон не найден');
  const name = body.name === undefined ? row.name : String(body.name).trim();
  if (name.length < 2) return fail(422, 'invalid_name', 'Укажите название шаблона', 'name');
  const text = body.body === undefined ? row.body : cleanTemplateBody(body.body).trim();
  if (text.length < 5) return fail(422, 'invalid_body', 'Текст шаблона слишком короткий', 'body');
  db.prepare(
    `UPDATE notification_templates SET name = ?, channel = ?, subject = ?, body = ?, is_active = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name.slice(0, MAX_NAME),
    CHANNELS.includes(body.channel) ? body.channel : row.channel,
    body.subject === undefined ? row.subject : String(body.subject || '').slice(0, MAX_SUBJECT) || null,
    text,
    body.isActive === undefined ? row.is_active : body.isActive ? 1 : 0,
    new Date().toISOString(),
    row.id
  );
  return { status: 200, body: { template: mapTemplate(db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(row.id)) } };
}

export function deleteTemplate(id) {
  const row = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(Number(id));
  if (!row) return fail(404, 'not_found', 'Шаблон не найден');
  if (row.is_system) return fail(409, 'system_template', 'Предустановленный шаблон можно изменить, но не удалить');
  db.prepare('DELETE FROM notification_templates WHERE id = ?').run(row.id);
  /* Сценарии, которые ссылались на удалённый шаблон, дальше работать не смогут. */
  const referenced = db
    .prepare("SELECT id FROM automations WHERE action = 'message' AND action_params LIKE ?")
    .all(`%${row.key}%`);
  for (const rule of referenced) {
    db.prepare('UPDATE automations SET is_active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), rule.id);
  }
  return { status: 200, body: { ok: true, id: row.id, affected: referenced.length } };
}

/* ------------------------------ текст и переменные ------------------------------ */

function ruDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Minsk' }).format(date);
}

function ruTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Minsk' }).format(date);
}

function settingString(name, fallback) {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  const data = parseJson(row?.data, {});
  const value = data?.[name];
  return value ? String(value) : fallback;
}

function money(value) {
  const symbol = settingString('currencySymbol', '₽');
  return `${new Intl.NumberFormat('ru-RU').format(round(value))}\u00a0${symbol}`;
}

export function templateContext({ bookingId = null, clientId = null } = {}) {
  const ctx = {
    client_name: 'Клиент',
    date: '14 мая',
    time: '15:30',
    service: 'Портретная съёмка',
    price: money(9000),
    duration: '120 минут',
    code: 'Hk3pQz7Lm2A',
    link: 'https://xenon.studio/b/Hk3pQz7Lm2A',
    studio: settingString('siteName', 'xenon.studio'),
    photographer: settingString('photographerName', 'Фотограф')
  };

  const booking = bookingId
    ? db
        .prepare(
          `SELECT b.*, c.name AS client_name, c.id AS client_id,
                  COALESCE(s.name, p.name, 'Съёмка') AS service_name
           FROM bookings b
           LEFT JOIN clients c ON c.id = b.client_id
           LEFT JOIN services s ON s.id = b.service_id
           LEFT JOIN packages p ON p.id = b.package_id
           WHERE b.id = ?`
        )
        .get(Number(bookingId))
    : null;

  if (booking) {
    ctx.client_name = String(booking.client_name || 'Клиент').split(' ')[0] || 'Клиент';
    ctx.date = ruDate(booking.starts_at);
    ctx.time = ruTime(booking.starts_at);
    ctx.service = booking.service_name;
    ctx.price = money(booking.price);
    ctx.duration = `${booking.duration_min} минут`;
    ctx.code = booking.public_code;
    ctx.link = `https://xenon.studio/b/${booking.public_code}`;
  } else if (clientId) {
    const client = db.prepare('SELECT name FROM clients WHERE id = ?').get(Number(clientId));
    if (client?.name) ctx.client_name = String(client.name).split(' ')[0];
  }

  return ctx;
}

export function renderTemplate(text, ctx) {
  return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const value = ctx?.[String(key).toLowerCase()];
    return value === undefined || value === null ? match : String(value);
  });
}

export function previewTemplate(body = {}) {
  const ctx = templateContext({ bookingId: body.bookingId, clientId: body.clientId });
  return {
    subject: renderTemplate(body.subject || '', ctx),
    body: renderTemplate(body.body || '', ctx)
  };
}

/* ------------------------------ сценарии ------------------------------ */

function normalizeParams(trigger, value) {
  const source = value && typeof value === 'object' ? value : {};
  const clamp = (input, min, max, fallback) => {
    const num = Number(input);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(Math.max(Math.round(num), min), max);
  };
  if (trigger === 'before_shoot') return { hours: clamp(source.hours, 1, 168, 24) };
  if (trigger === 'after_shoot') return { days: clamp(source.days, 0, 60, 1) };
  if (trigger === 'no_visits') return { days: clamp(source.days, 7, 730, 60) };
  if (trigger === 'status_changed') return { statusId: source.statusId ? Number(source.statusId) : null };
  return {};
}

function normalizeConditions(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    serviceId: source.serviceId ? Number(source.serviceId) : null,
    minAmount: source.minAmount ? round(source.minAmount) : 0,
    source: ['client', 'admin'].includes(source.source) ? source.source : null,
    clientTag: String(source.clientTag || '').trim().slice(0, 24) || null
  };
}

function normalizeActionParams(action, value) {
  const source = value && typeof value === 'object' ? value : {};
  if (action === 'message') {
    return {
      templateKey: String(source.templateKey || '').slice(0, 40) || null,
      channel: ['telegram', 'email'].includes(source.channel) ? source.channel : null
    };
  }
  if (action === 'notification') {
    return { title: String(source.title || '').slice(0, 120) || null };
  }
  if (action === 'status') return { statusId: source.statusId ? Number(source.statusId) : null };
  if (action === 'tag') return { tag: String(source.tag || '').trim().slice(0, 24) || 'Автоматизация' };
  if (action === 'bonus') return { amount: Math.min(Math.max(round(source.amount), 1), 100000) };
  return {};
}

function mapRule(row) {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    params: parseJson(row.params, {}),
    conditions: parseJson(row.conditions, {}),
    action: row.action,
    actionParams: parseJson(row.action_params, {}),
    isActive: Boolean(row.is_active),
    runs: row.runs,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at
  };
}

export function listRules() {
  const items = db.prepare('SELECT * FROM automations ORDER BY is_active DESC, id ASC').all().map(mapRule);
  const log = db
    .prepare(
      `SELECT l.*, a.name AS automation_name FROM automation_log l
       LEFT JOIN automations a ON a.id = l.automation_id
       ORDER BY l.id DESC LIMIT 30`
    )
    .all()
    .map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      automationName: row.automation_name || 'Сценарий',
      bookingId: row.booking_id,
      clientId: row.client_id,
      status: row.status,
      message: row.message,
      createdAt: row.created_at
    }));
  return {
    items,
    log,
    meta: {
      triggers: Object.entries(TRIGGERS).map(([id, info]) => ({ id, ...info })),
      actions: Object.entries(ACTIONS).map(([id, info]) => ({ id, ...info })),
      templates: db
        .prepare('SELECT id, key, name, channel FROM notification_templates ORDER BY sort_order, id')
        .all(),
      statuses: db
        .prepare('SELECT id, name FROM statuses WHERE deleted_at IS NULL ORDER BY sort_order')
        .all(),
      services: db
        .prepare('SELECT id, name FROM services WHERE deleted_at IS NULL AND is_active = 1 ORDER BY sort_order, id')
        .all()
    }
  };
}

function validateRule(body) {
  const name = String(body.name || '').trim();
  if (name.length < 2) return fail(422, 'invalid_name', 'Укажите название сценария', 'name');
  if (!TRIGGERS[body.trigger]) return fail(422, 'invalid_trigger', 'Неизвестное событие запуска', 'trigger');
  if (!ACTIONS[body.action]) return fail(422, 'invalid_action', 'Неизвестное действие', 'action');
  const actionParams = normalizeActionParams(body.action, body.actionParams);
  if (body.action === 'message' && !actionParams.templateKey) {
    return fail(422, 'no_template', 'Выберите шаблон сообщения', 'templateKey');
  }
  if (body.action === 'status' && !actionParams.statusId) {
    return fail(422, 'no_status', 'Выберите статус', 'statusId');
  }
  if (body.trigger === 'status_changed' && !Number(body.params?.statusId)) {
    return fail(422, 'no_status', 'Выберите статус, по которому срабатывает сценарий', 'params');
  }
  return {
    name: name.slice(0, MAX_NAME),
    trigger: body.trigger,
    params: normalizeParams(body.trigger, body.params),
    conditions: normalizeConditions(body.conditions),
    action: body.action,
    actionParams
  };
}

export function createRule(body = {}) {
  const checked = validateRule(body);
  if (checked.status) return checked;
  const info = db
    .prepare(
      `INSERT INTO automations (name, trigger, params, conditions, action, action_params, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      checked.name,
      checked.trigger,
      JSON.stringify(checked.params),
      JSON.stringify(checked.conditions),
      checked.action,
      JSON.stringify(checked.actionParams),
      body.isActive === false ? 0 : 1
    );
  logActivity({ type: 'settings', title: 'Создан сценарий автоматизации', description: checked.name, entity: 'automation', entityId: Number(info.lastInsertRowid) });
  return { status: 201, body: { rule: mapRule(db.prepare('SELECT * FROM automations WHERE id = ?').get(info.lastInsertRowid)) } };
}

export function updateRule(id, body = {}) {
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(Number(id));
  if (!row) return fail(404, 'not_found', 'Сценарий не найден');
  const merged = {
    name: body.name ?? row.name,
    trigger: body.trigger ?? row.trigger,
    params: body.params ?? parseJson(row.params, {}),
    conditions: body.conditions ?? parseJson(row.conditions, {}),
    action: body.action ?? row.action,
    actionParams: body.actionParams ?? parseJson(row.action_params, {})
  };
  const checked = validateRule(merged);
  if (checked.status) return checked;
  db.prepare(
    `UPDATE automations SET name = ?, trigger = ?, params = ?, conditions = ?, action = ?, action_params = ?,
            is_active = ?, updated_at = ? WHERE id = ?`
  ).run(
    checked.name,
    checked.trigger,
    JSON.stringify(checked.params),
    JSON.stringify(checked.conditions),
    checked.action,
    JSON.stringify(checked.actionParams),
    body.isActive === undefined ? row.is_active : body.isActive ? 1 : 0,
    new Date().toISOString(),
    row.id
  );
  return { status: 200, body: { rule: mapRule(db.prepare('SELECT * FROM automations WHERE id = ?').get(row.id)) } };
}

export function deleteRule(id) {
  const row = db.prepare('SELECT id FROM automations WHERE id = ?').get(Number(id));
  if (!row) return fail(404, 'not_found', 'Сценарий не найден');
  db.prepare('DELETE FROM automation_marks WHERE automation_id = ?').run(row.id);
  db.prepare('DELETE FROM automations WHERE id = ?').run(row.id);
  return { status: 200, body: { ok: true, id: row.id } };
}

/* ------------------------------ выполнение ------------------------------ */

function markSeen(automationId, entity, entityId, mark) {
  const exists = db
    .prepare('SELECT 1 FROM automation_marks WHERE automation_id = ? AND entity = ? AND entity_id = ? AND mark = ?')
    .get(automationId, entity, entityId, mark);
  if (exists) return false;
  db.prepare('INSERT INTO automation_marks (automation_id, entity, entity_id, mark) VALUES (?, ?, ?, ?)').run(
    automationId,
    entity,
    entityId,
    mark
  );
  return true;
}

function writeLog({ automationId = null, bookingId = null, clientId = null, status = 'ok', message }) {
  db.prepare(
    'INSERT INTO automation_log (automation_id, booking_id, client_id, status, message) VALUES (?, ?, ?, ?, ?)'
  ).run(automationId, bookingId, clientId, status, String(message).slice(0, 300));
}

function matchesConditions(rule, { booking, client }) {
  const conditions = rule.conditions || {};
  if (conditions.serviceId) {
    const serviceId = booking?.serviceId || booking?.service_id;
    if (Number(serviceId) !== Number(conditions.serviceId)) return false;
  }
  if (conditions.minAmount && round(booking?.price) < round(conditions.minAmount)) return false;
  if (conditions.source && booking?.source !== conditions.source) return false;
  if (conditions.clientTag) {
    const tags = parseJson(client?.tags, []);
    if (!Array.isArray(tags) || !tags.includes(conditions.clientTag)) return false;
  }
  return true;
}

function bookingBundle(bookingId) {
  const booking = db
    .prepare(
      `SELECT b.*, c.name AS client_name, c.tags AS client_tags, c.phone AS client_phone,
              c.email AS client_email, c.telegram_username, c.is_blacklisted
       FROM bookings b LEFT JOIN clients c ON c.id = b.client_id
       WHERE b.id = ? AND b.deleted_at IS NULL`
    )
    .get(Number(bookingId));
  if (!booking) return null;
  const client = booking.client_id
    ? {
        id: booking.client_id,
        name: booking.client_name,
        tags: booking.client_tags,
        phone: booking.client_phone,
        email: booking.client_email,
        telegram: booking.telegram_username,
        isBlacklisted: Boolean(booking.is_blacklisted)
      }
    : null;
  return { booking, client };
}

function dispatchMessage(rule, { booking, client }) {
  const template = db
    .prepare('SELECT * FROM notification_templates WHERE key = ? AND is_active = 1')
    .get(rule.actionParams.templateKey);
  if (!template) return { ok: false, message: 'Шаблон отключён или удалён' };
  if (!client?.id) return { ok: false, message: 'У записи нет клиента' };
  if (client.isBlacklisted) return { ok: false, message: 'Клиент в чёрном списке' };

  const preferred = rule.actionParams.channel || template.channel || 'telegram';
  /* Если нужного канала у клиента нет, пробуем второй — лучше письмо, чем тишина. */
  const channel = [preferred, preferred === 'telegram' ? 'email' : 'telegram'].find((item) =>
    item === 'email' ? Boolean(client.email) : Boolean(client.telegram)
  );
  if (!channel) return { ok: false, message: 'У клиента нет контактов для отправки' };

  const conv = ensureConversation(client.id);
  if (conv.status !== 200 && conv.status !== 201) return { ok: false, message: 'Не удалось открыть диалог' };
  const ctx = templateContext({ bookingId: booking.id, clientId: client.id });
  const sent = sendMessage(conv.body.id, {
    channel,
    subject: template.subject ? renderTemplate(template.subject, ctx) : null,
    body: renderTemplate(template.body, ctx)
  });
  if (sent.status !== 201) return { ok: false, message: sent.body?.message || 'Сообщение не отправлено' };
  return { ok: true, message: `«${template.name}» → ${channel === 'email' ? 'почта' : 'Telegram'}` };
}

function dispatchNotification(rule, { booking, client }) {
  const title = rule.actionParams.title || rule.name;
  const subtitle = client?.name
    ? `${client.name}${booking ? ` · ${ruDate(booking.starts_at)}` : ''}`
    : 'Сценарий автоматизации';
  db.prepare(
    `INSERT INTO notifications (kind, title, subtitle, action_label, action_url, is_read)
     VALUES ('automation', ?, ?, 'Открыть записи', '/admin/bookings', 0)`
  ).run(title, subtitle);
  return { ok: true, message: `Уведомление «${title}»` };
}

function dispatchStatus(rule, { booking }) {
  const status = db
    .prepare('SELECT * FROM statuses WHERE id = ? AND deleted_at IS NULL')
    .get(Number(rule.actionParams.statusId));
  if (!status) return { ok: false, message: 'Статус не найден' };
  if (!booking) return { ok: false, message: 'Нет записи для смены статуса' };
  if (Number(booking.status_id) === Number(status.id)) return { ok: false, message: `Статус уже «${status.name}»` };
  const now = new Date().toISOString();
  db.prepare('UPDATE bookings SET status_id = ?, updated_at = ? WHERE id = ?').run(status.id, now, booking.id);
  db.prepare('INSERT INTO booking_events (booking_id, type, title, message, actor) VALUES (?, ?, ?, ?, ?)').run(
    booking.id,
    'status',
    `Статус изменён: ${status.name}`,
    'Автоматизация',
    'system'
  );
  if (status.is_final) {
    try {
      onBookingCompleted(booking.id);
    } catch (err) {
      console.error('[automation] бонусы:', err?.message || err);
    }
  }
  return { ok: true, message: `Статус → ${status.name}` };
}

function dispatchTag(rule, { client }) {
  if (!client?.id) return { ok: false, message: 'У записи нет клиента' };
  const row = db.prepare('SELECT tags FROM clients WHERE id = ?').get(client.id);
  const tags = parseJson(row?.tags, []);
  const tag = rule.actionParams.tag;
  if (tags.includes(tag)) return { ok: false, message: `Метка «${tag}» уже стоит` };
  tags.push(tag);
  db.prepare('UPDATE clients SET tags = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(tags.slice(0, 12)),
    new Date().toISOString(),
    client.id
  );
  return { ok: true, message: `Метка «${tag}»` };
}

function dispatchBonus(rule, { client }) {
  if (!client?.id) return { ok: false, message: 'У записи нет клиента' };
  const amount = round(rule.actionParams.amount);
  if (amount <= 0) return { ok: false, message: 'Не указана сумма баллов' };
  db.prepare('INSERT OR IGNORE INTO bonus_accounts (client_id, balance, total_earned, total_spent) VALUES (?, 0, 0, 0)').run(
    client.id
  );
  db.prepare(
    `INSERT INTO bonus_transactions (client_id, booking_id, kind, amount, reason, created_at)
     VALUES (?, NULL, 'adjust', ?, ?, ?)`
  ).run(client.id, amount, `Автоматизация: ${rule.name}`, new Date().toISOString());
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS spent
       FROM bonus_transactions WHERE client_id = ?`
    )
    .get(client.id);
  db.prepare('UPDATE bonus_accounts SET balance = ?, total_earned = ?, total_spent = ?, updated_at = ? WHERE client_id = ?').run(
    Math.max(round(totals.earned) - round(totals.spent), 0),
    round(totals.earned),
    round(totals.spent),
    new Date().toISOString(),
    client.id
  );
  return { ok: true, message: `+${amount} баллов` };
}

function execute(rule, bundle) {
  if (rule.action === 'message') return dispatchMessage(rule, bundle);
  if (rule.action === 'notification') return dispatchNotification(rule, bundle);
  if (rule.action === 'status') return dispatchStatus(rule, bundle);
  if (rule.action === 'tag') return dispatchTag(rule, bundle);
  if (rule.action === 'bonus') return dispatchBonus(rule, bundle);
  return { ok: false, message: 'Неизвестное действие' };
}

function recordRun(rule, bundle, outcome) {
  db.prepare('UPDATE automations SET runs = runs + 1, last_run_at = ? WHERE id = ?').run(new Date().toISOString(), rule.id);
  writeLog({
    automationId: rule.id,
    bookingId: bundle.booking?.id || null,
    clientId: bundle.client?.id || null,
    status: outcome.ok ? 'ok' : 'skipped',
    message: `${rule.name}: ${outcome.message}`
  });
  return outcome;
}

/* События: новая заявка, смена статуса. */
export function handleEvent(event, payload = {}) {
  const rules = db
    .prepare('SELECT * FROM automations WHERE is_active = 1 AND trigger = ? ORDER BY id')
    .all(event)
    .map(mapRule);
  if (!rules.length) return [];
  const bundle = payload.bookingId ? bookingBundle(payload.bookingId) : null;
  if (!bundle) return [];

  const results = [];
  for (const rule of rules) {
    if (event === 'status_changed' && Number(rule.params.statusId) !== Number(payload.statusId)) continue;
    if (!matchesConditions(rule, bundle)) continue;
    const mark = `${event}:${payload.statusId || 'any'}`;
    if (!markSeen(rule.id, 'booking', bundle.booking.id, mark)) continue;
    results.push(recordRun(rule, bundle, execute(rule, bundle)));
  }
  return results;
}

/* Сценарии по времени: напоминания, письма после съёмки, возврат клиентов. */
export function tick(now = new Date()) {
  const rules = db.prepare('SELECT * FROM automations WHERE is_active = 1').all().map(mapRule);
  const results = [];
  const nowIso = now.toISOString();

  for (const rule of rules) {
    if (rule.trigger === 'before_shoot') {
      const hours = Number(rule.params.hours) || 24;
      const until = new Date(now.getTime() + hours * 3600 * 1000).toISOString();
      const rows = db
        .prepare(
          `SELECT b.id FROM bookings b LEFT JOIN statuses st ON st.id = b.status_id
           WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
             AND b.starts_at > ? AND b.starts_at <= ?`
        )
        .all(nowIso, until);
      for (const row of rows) {
        const bundle = bookingBundle(row.id);
        if (!bundle || !matchesConditions(rule, bundle)) continue;
        if (!markSeen(rule.id, 'booking', row.id, `before:${hours}`)) continue;
        results.push(recordRun(rule, bundle, execute(rule, bundle)));
      }
    }

    if (rule.trigger === 'after_shoot') {
      const days = Number(rule.params.days) || 1;
      const until = new Date(now.getTime() - days * 86400 * 1000).toISOString();
      /* Старые съёмки не трогаем: письмо уходит только по свежим записям. */
      const since = new Date(now.getTime() - 60 * 86400 * 1000).toISOString();
      const rows = db
        .prepare(
          `SELECT b.id FROM bookings b LEFT JOIN statuses st ON st.id = b.status_id
           WHERE b.deleted_at IS NULL AND COALESCE(st.is_cancelled, 0) = 0
             AND b.starts_at <= ? AND b.starts_at >= ?`
        )
        .all(until, since);
      for (const row of rows) {
        const bundle = bookingBundle(row.id);
        if (!bundle || !matchesConditions(rule, bundle)) continue;
        if (!markSeen(rule.id, 'booking', row.id, `after:${days}`)) continue;
        results.push(recordRun(rule, bundle, execute(rule, bundle)));
      }
    }

    if (rule.trigger === 'no_visits') {
      const days = Number(rule.params.days) || 60;
      const until = new Date(now.getTime() - days * 86400 * 1000).toISOString();
      const monthMark = dayKey(now).slice(0, 7);
      const rows = db
        .prepare(
          `SELECT c.id, c.name, c.tags, c.phone, c.email, c.telegram_username, c.is_blacklisted,
                  (SELECT MAX(b.starts_at) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS last_at
           FROM clients c WHERE c.deleted_at IS NULL AND c.is_blacklisted = 0`
        )
        .all();
      for (const client of rows) {
        if (client.last_at && String(client.last_at) > until) continue;
        if (!markSeen(rule.id, 'client', client.id, `no_visits:${monthMark}`)) continue;
        const bundle = {
          booking: null,
          client: {
            id: client.id,
            name: client.name,
            tags: client.tags,
            phone: client.phone,
            email: client.email,
            telegram: client.telegram_username,
            isBlacklisted: Boolean(client.is_blacklisted)
          }
        };
        if (!matchesConditions(rule, bundle)) continue;
        const outcome = rule.action === 'message' ? dispatchMessage(rule, bundle) : execute(rule, bundle);
        results.push(recordRun(rule, bundle, outcome));
      }
    }
  }

  return results;
}

/** Ручной запуск сценария из панели — по последней подходящей записи клиента. */
export function runRule(id) {
  const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(Number(id));
  if (!row) return fail(404, 'not_found', 'Сценарий не найден');
  const rule = mapRule(row);
  let bundle = null;

  if (rule.trigger === 'no_visits') {
    const client = db
      .prepare(
        `SELECT c.*, (SELECT MAX(b.starts_at) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS last_at
         FROM clients c WHERE c.deleted_at IS NULL ORDER BY COALESCE(last_at, '0000') ASC LIMIT 1`
      )
      .get();
    if (client) {
      bundle = {
        booking: null,
        client: {
          id: client.id,
          name: client.name,
          tags: client.tags,
          phone: client.phone,
          email: client.email,
          telegram: client.telegram_username,
          isBlacklisted: Boolean(client.is_blacklisted)
        }
      };
    }
  } else {
    const booking = db
      .prepare('SELECT id FROM bookings WHERE deleted_at IS NULL ORDER BY datetime(starts_at) DESC LIMIT 1')
      .get();
    if (booking) bundle = bookingBundle(booking.id);
  }

  if (!bundle) return fail(409, 'nothing_to_run', 'Нет данных для проверки сценария');
  const outcome = recordRun(rule, bundle, execute(rule, bundle));
  return {
    status: outcome.ok ? 200 : 409,
    body: outcome.ok
      ? { ok: true, message: outcome.message, rule: mapRule(db.prepare('SELECT * FROM automations WHERE id = ?').get(rule.id)) }
      : { error: 'not_sent', message: outcome.message }
  };
}

export function clearLog() {
  db.prepare('DELETE FROM automation_log').run();
  return { status: 200, body: { ok: true } };
}
