import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, saveSettings, getSettings } from '../db.js';

export const DEMO_EMAIL = 'studio@xenon.studio';
export const DEMO_PASSWORD = 'xenon2026';

export function makePublicCode(len = 11) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/* local (Europe/Minsk, UTC+3) wall-clock → ISO string */
const TZ_OFFSET = 3;
function iso(dayOffset, hour = 10, minute = 0) {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour - TZ_OFFSET, minute, 0);
  return new Date(base).toISOString();
}

function hasData() {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const settings = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n;
  return users > 0 || settings > 0;
}

function dayKey(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Демо-студия с примерами записей — только для разработки и предпросмотра.
 * На боевом сервере база поднимается пустой: приложение само создаёт схему,
 * а фотограф проходит регистрацию при первом запуске.
 * XENON_SEED=demo — включить демо принудительно, XENON_SEED=0 — выключить.
 */
export function demoSeedEnabled() {
  const flag = String(process.env.XENON_SEED || '').toLowerCase();
  if (flag === '0' || flag === 'off' || flag === 'false') return false;
  if (flag === 'demo' || flag === '1' || flag === 'true' || flag === 'on') return true;
  return process.env.NODE_ENV !== 'production';
}

export function ensureSeed() {
  if (!demoSeedEnabled()) return false;
  if (hasData()) return false;

  const now = new Date().toISOString();

  const seed = db.transaction(() => {
    /* photographer */
    const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
    db.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)').run(
      DEMO_EMAIL,
      passwordHash,
      'Ксения Ветрова',
      now
    );

    saveSettings({
      photographerName: 'Ксения Ветрова',
      siteName: 'xenon.studio',
      brandTagline: 'Фотограф · естественный свет и живые эмоции',
      landingEnabled: true,
      contacts: {
        phone: '+375 29 120-45-67',
        telegram: 'xenon_studio',
        instagram: 'xenon.studio',
        email: 'hello@xenon.studio'
      },
      agreement: {
        enabled: true,
        text: 'Съёмка переносится бесплатно не позднее чем за 12 часов. Оплата — в день съёмки. Готовые кадры приходят ссылкой на галерею в течение 14 дней.',
        consentText: 'Согласен с условиями съёмки'
      },
      loyalty: { enabled: true, percent: 5, afterSessions: 3 },
      vipDiscount: { enabled: true, percent: 10 },
      chatEnabled: true
    });

    /* services */
    const services = [
      {
        name: 'Портретная съёмка',
        description: 'Два часа в студии или на локации, 25 обработанных кадров, помощь с образами.',
        price: 9000,
        duration: 120,
        buffer: 30,
        addons: [
          { id: 'retouch', name: 'Расширенная ретушь', type: 'toggle', price: 2500 },
          { id: 'makeup', name: 'Визажист', type: 'toggle', price: 4000 },
          { id: 'extra', name: 'Дополнительные кадры', type: 'quantity', price: 700, unit: 'шт' }
        ]
      },
      {
        name: 'Love story',
        description: 'Полтора часа на природе или в городе, 30 кадров, прогулка без спешки.',
        price: 7500,
        duration: 90,
        buffer: 20,
        addons: [
          { id: 'retouch', name: 'Расширенная ретушь', type: 'toggle', price: 2500 },
          { id: 'extra', name: 'Дополнительные кадры', type: 'quantity', price: 700, unit: 'шт' }
        ]
      },
      {
        name: 'Семейная съёмка',
        description: 'Час вместе с близкими, 20 кадров, тёплые живые истории.',
        price: 6500,
        duration: 60,
        buffer: 20,
        addons: [
          { id: 'extra', name: 'Дополнительные кадры', type: 'quantity', price: 700, unit: 'шт' },
          { id: 'album', name: 'Фотокнига', type: 'toggle', price: 5500 }
        ]
      },
      {
        name: 'Контент-съёмка для блога',
        description: 'Три часа, 60 кадров, несколько образов и локаций внутри студии.',
        price: 14000,
        duration: 180,
        buffer: 30,
        addons: [
          { id: 'makeup', name: 'Визажист', type: 'toggle', price: 4000 },
          { id: 'extra', name: 'Дополнительные кадры', type: 'quantity', price: 600, unit: 'шт' }
        ]
      },
      {
        name: 'Мини-съёмка в студии',
        description: 'Сорок минут, 10 кадров, идеально для обновления аватарок.',
        price: 4500,
        duration: 40,
        buffer: 15,
        addons: [{ id: 'retouch', name: 'Расширенная ретушь', type: 'toggle', price: 2000 }]
      }
    ];

    const insertService = db.prepare(
      `INSERT INTO services (name, description, price, duration_min, buffer_min, addons, is_active, sort_order)
       VALUES (@name, @description, @price, @duration, @buffer, @addons, 1, @sort)`
    );
    const serviceIds = services.map((s, i) => {
      const info = insertService.run({
        name: s.name,
        description: s.description,
        price: s.price,
        duration: s.duration,
        buffer: s.buffer,
        addons: JSON.stringify(s.addons),
        sort: i
      });
      return Number(info.lastInsertRowid);
    });

    const insertPackage = db.prepare(
      `INSERT INTO packages (name, description, price, service_ids, addons, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    );
    insertPackage.run(
      'Портрет + визаж',
      'Портретная съёмка с визажистом: два часа, 25 кадров, макияж и укладка.',
      12000,
      JSON.stringify([serviceIds[0]]),
      JSON.stringify([{ id: 'makeup', name: 'Визажист', type: 'toggle', price: 0 }]),
      0
    );
    insertPackage.run(
      'Семейный день',
      'Семейная съёмка и мини-съёмка ребёнка, час сорок, 35 кадров.',
      15000,
      JSON.stringify([serviceIds[2], serviceIds[4]]),
      '[]',
      1
    );

    /* statuses */
    const statuses = [
      ['Заявка', '#f59e0b', 1, 0, 1, 1, 0],
      ['Подтверждена', '#2563eb', 0, 0, 1, 1, 0],
      ['Съёмка проведена', '#8b5cf6', 0, 0, 0, 0, 0],
      ['Обработка', '#0ea5e9', 0, 0, 0, 0, 0],
      ['Завершена', '#16a34a', 0, 1, 0, 1, 0],
      ['Отклонена', '#ef4444', 0, 0, 0, 0, 1]
    ];
    const statusIds = statuses.map(([name, color, isInitial, isFinal, canReschedule, canCancel, isCancelled], i) => {
      const info = db
        .prepare(
          `INSERT INTO statuses (name, color, sort_order, is_initial, is_final, is_cancelled, client_can_reschedule, client_can_cancel)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(name, color, name === 'Отклонена' ? 900 : i, isInitial, isFinal, isCancelled, canReschedule, canCancel);
      return Number(info.lastInsertRowid);
    });

    /* clients */
    const clients = [
      ['Анна Ковалёва', '+375 29 441-22-08', 'anna.kovaleva@mail.ru', 'anna_kov', 'anna.kov', ['VIP', 'Портрет'], 1, 4, 0],
      ['Мария Лебедева', '+375 33 705-91-14', 'm.lebedeva@gmail.com', 'masha_leb', 'masha.leb', ['Love story'], 0, 2, 1],
      ['Дмитрий Орлов', '+375 25 118-40-73', 'd.orlov@yandex.ru', 'dmitry_orlov', null, ['Бизнес'], 0, 3, 2],
      ['Елена Соколова', '+375 44 623-18-52', 'elena.sokolova@mail.ru', 'elena_sok', 'elena.sok', ['Семья'], 1, 5, 0],
      ['Ирина Жукова', '+375 29 887-30-41', 'irina.zh@gmail.com', 'irina_zh', 'irina.zh', ['Контент'], 0, 1, 1],
      ['Павел Никитин', '+375 33 214-76-09', 'pavel.nikitin@mail.ru', 'pavel_n', null, ['Портрет'], 0, 2, 3],
      ['Ольга Морозова', '+375 25 559-04-28', 'olga.morozova@gmail.com', 'olga_mor', 'olga.mor', ['Семья', 'VIP'], 1, 6, 0],
      ['Виктория Смирнова', '+375 44 301-66-90', 'vika.smirnova@mail.ru', 'vika_sm', 'vika.sm', [], 0, 1, 4],
      ['Алина Гурская', '+375 29 604-17-35', 'alina.gurskaya@gmail.com', 'alina_gur', 'alina.gur', ['Новый клиент'], 0, 0, 0],
      ['Сергей Мельник', '+375 33 508-92-61', 's.melnik@mail.ru', null, null, ['Новый клиент'], 0, 0, 0]
    ];

    const clientCreatedOffsets = [-150, -128, -104, -78, -52, -26, -12, -5, 0, 0];
    const clientIds = clients.map(([name, phone, email, tg, ig, tags, vip, sessions, offset], index) => {
      const info = db
        .prepare(
          `INSERT INTO clients (name, phone, email, telegram_username, instagram, tags, is_vip, created_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name,
          phone,
          email,
          tg,
          ig,
          JSON.stringify(tags),
          vip,
          iso(clientCreatedOffsets[index]),
          sessions > 3 ? 'Постоянный клиент, любит естественный свет и минимум ретуши.' : null
        );
      return Number(info.lastInsertRowid);
    });

    /* bookings */
    const bookingRows = [
      [0, 10, 0, 0, 1, 0, 'Подтверждена', 'Портретная съёмка в студии, образ — светлый минимализм.'],
      [0, 15, 30, 1, 1, 0, 'Заявка', null],
      [1, 12, 0, 2, 4, 0, 'Подтверждена', 'Семейная съёмка на природе, ребёнку 4 года.'],
      [1, 17, 0, 0, 3, 0, 'Заявка', null],
      [2, 11, 0, 3, 1, 1, 'Подтверждена', 'Love story в ботаническом саду.'],
      [3, 13, 0, 4, 0, 0, 'Заявка', null],
      [4, 10, 30, 5, 4, 0, 'Подтверждена', 'Контент-съёмка для блога, три образа.'],
      [-1, 12, 0, 6, 4, 0, 'Завершена', null],
      [-2, 12, 0, 1, 2, 0, 'Съёмка проведена', null],
      [-3, 10, 0, 3, 1, 0, 'Завершена', null],
      [-4, 16, 0, 6, 0, 0, 'Обработка', 'Портрет, ретушь выборочная.'],
      [-5, 16, 0, 0, 0, 0, 'Завершена', null],
      [-6, 11, 30, 7, 2, 0, 'Завершена', null],
      [-7, 11, 0, 3, 2, 0, 'Завершена', null],
      [-8, 13, 0, 4, 3, 0, 'Завершена', null],
      [-9, 10, 0, 5, 4, 0, 'Завершена', null],
      [-10, 15, 0, 1, 0, 1, 'Завершена', null],
      [-11, 14, 0, 0, 4, 0, 'Завершена', null],
      [-12, 12, 30, 2, 2, 0, 'Завершена', null],
      [-13, 17, 0, 6, 1, 0, 'Завершена', null],
      [-14, 10, 0, 4, 0, 0, 'Завершена', 'Портретная съёмка для соцсетей.'],
      [-16, 11, 0, 3, 0, 0, 'Завершена', null],
      [-17, 14, 0, 0, 4, 0, 'Завершена', null],
      [-19, 15, 30, 7, 1, 1, 'Завершена', null],
      [-20, 10, 0, 7, 3, 0, 'Завершена', null],
      [-22, 16, 30, 4, 1, 0, 'Завершена', null],
      [-24, 12, 0, 5, 2, 0, 'Завершена', null],
      [-25, 12, 0, 5, 2, 0, 'Завершена', null],
      [-27, 15, 0, 1, 0, 0, 'Завершена', null],
      [-29, 11, 0, 6, 4, 0, 'Завершена', null],
      [-31, 13, 0, 2, 0, 0, 'Завершена', null],
      [-33, 13, 0, 2, 2, 0, 'Завершена', null],
      [-36, 10, 30, 3, 1, 0, 'Завершена', null],
      [-38, 11, 0, 6, 4, 0, 'Завершена', 'Контент для блога о материнстве.'],
      [-40, 16, 0, 0, 0, 0, 'Завершена', null],
      [-44, 12, 0, 7, 3, 0, 'Завершена', null],
      [-48, 11, 0, 4, 4, 0, 'Завершена', null],
      [-52, 14, 30, 5, 2, 0, 'Завершена', null],
      [-57, 10, 0, 1, 0, 1, 'Завершена', null],
      [-62, 15, 0, 6, 1, 0, 'Завершена', null],
      [-68, 12, 0, 2, 2, 0, 'Завершена', null],
      [-74, 16, 0, 0, 3, 0, 'Завершена', null],
      /* upcoming month — keeps the calendar and «следующая съёмка» alive */
      [5, 12, 0, 3, 2, 0, 'Подтверждена', 'Съёмка в студии, два образа.'],
      [6, 15, 30, 5, 4, 0, 'Подтверждена', null],
      [7, 11, 0, 0, 0, 0, 'Подтверждена', 'Портрет для профиля, деловой стиль.'],
      [9, 16, 0, 2, 3, 0, 'Подтверждена', 'Прогулка в парке, золотая осень.'],
      [10, 10, 30, 6, 1, 0, 'Заявка', null],
      [12, 13, 0, 4, 0, 0, 'Подтверждена', null],
      [14, 17, 0, 7, 4, 0, 'Подтверждена', 'Свадебная съёмка, полный день.'],
      [17, 12, 0, 1, 2, 0, 'Подтверждена', 'Семейная съёмка дома при естественном свете.'],
      [19, 11, 0, 3, 1, 0, 'Подтверждена', null],
      [21, 15, 0, 5, 4, 0, 'Подтверждена', 'Контент-съёмка для маркетплейса.'],
      [24, 10, 0, 0, 0, 0, 'Заявка', null],
      [27, 14, 30, 6, 3, 0, 'Подтверждена', null],
      [30, 12, 0, 2, 2, 0, 'Подтверждена', 'Детская съёмка, торт-сюрприз.'],
      [33, 16, 0, 4, 1, 0, 'Подтверждена', null],
      [36, 11, 0, 7, 0, 0, 'Подтверждена', 'Портретная серия для соцсетей.'],
      [39, 13, 30, 1, 2, 0, 'Подтверждена', null],
      [8, 15, 0, 8, 0, 0, 'Заявка', 'Первый раз на съёмке, нужен совет по образу.'],
      [11, 12, 30, 9, 4, 0, 'Подтверждена', 'Мини-съёмка для профиля.']
    ];

    const insertBooking = db.prepare(
      `INSERT INTO bookings (public_code, client_id, service_id, package_id, starts_at, duration_min, price, addons, status_id, source, notes, gallery_url, created_at, updated_at)
       VALUES (@code, @client, @service, @pkg, @starts, @duration, @price, @addons, @status, @source, @notes, @gallery, @created, @updated)`
    );
    const insertEvent = db.prepare(
      `INSERT INTO booking_events (booking_id, type, title, message, actor, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    );

    bookingRows.forEach(([day, hour, minute, clientIdx, serviceIdx, isPackage, statusName, notes], i) => {
      const service = services[serviceIdx];
      const statusIdx = statuses.findIndex((s) => s[0] === statusName);
      const price = isPackage ? 12000 : service.price;
      const startsIso = iso(day, hour, minute);
      const created = new Date(new Date(startsIso).getTime() - (2 + (i % 4)) * 864e5).toISOString();
      const info = insertBooking.run({
        code: makePublicCode(),
        client: clientIds[clientIdx],
        service: isPackage ? null : serviceIds[serviceIdx],
        pkg: isPackage ? 1 : null,
        starts: startsIso,
        duration: service.duration,
        price,
        addons: '[]',
        status: statusIds[statusIdx],
        source: i % 3 === 0 ? 'admin' : 'link',
        notes,
        gallery: statusIdx >= 3 ? 'https://disk.yandex.ru/d/gallery-demo' : null,
        created,
        updated: created
      });
      const id = Number(info.lastInsertRowid);
      insertEvent.run(id, 'created', 'Заявка создана', i % 3 === 0 ? 'Создана фотографом' : 'Клиент оставил заявку через форму', i % 3 === 0 ? 'photographer' : 'client', created);
      if (statusIdx >= 1) insertEvent.run(id, 'status', 'Статус изменён: Подтверждена', null, 'photographer', created);
      if (statusIdx >= 2) insertEvent.run(id, 'status', `Статус изменён: ${statusName}`, null, 'photographer', created);
    });

    /* conversations + messages */
    const convSpecs = [
      [1, 'telegram', [
        ['in', 'text', 'Здравствуйте! Хотела уточнить, можно ли взять с собой второй образ?', iso(-1, 18, 12)],
        ['out', 'text', 'Здравствуйте, Мария! Конечно, можно — время позволяет. Возьмите, пожалуйста, оба.', iso(-1, 18, 30)],
        ['system', 'telegram', 'Напоминание: съёмка завтра в 15:30', iso(0, 8, 0)],
        ['in', 'text', 'Спасибо! А подскажите, где именно встречаемся?', iso(0, 8, 24)]
      ]],
      [3, 'telegram', [
        ['system', 'telegram', 'Заявка принята: Семейная съёмка, 1 сентября в 12:00', iso(-2, 14, 5)],
        ['in', 'text', 'Добрый день! Подскажите, во что лучше одеться детям?', iso(-2, 19, 40)],
        ['out', 'text', 'Здравствуйте! Лучше спокойные светлые тона без крупных принтов — так кадры получаются мягче.', iso(-2, 20, 2)],
        ['in', 'text', 'Поняла, спасибо большое!', iso(-2, 20, 15)]
      ]],
      [4, 'email', [
        ['system', 'email', 'Напоминание о съёмке отправлено на irina.zh@gmail.com', iso(-3, 9, 0)],
        ['out', 'email', 'Здравствуйте, Ирина! Напоминаю про контент-съёмку — пришлите, пожалуйста, референсы заранее.', iso(-3, 9, 2)],
        ['in', 'text', 'Добрый день! Отправила ссылку на доску с идеями, посмотрите.', iso(-3, 12, 47)]
      ]],
      [6, 'telegram', [
        ['in', 'text', 'Ксения, добрый день! Хочу записаться на мини-съёмку в конце месяца.', iso(-5, 11, 20)],
        ['out', 'text', 'Здравствуйте, Ольга! Свободно 28 и 29 числа, после 16:00. Что удобнее?', iso(-5, 11, 55)]
      ]]
    ];

    const insertConv = db.prepare('INSERT INTO conversations (client_id, last_channel, last_message_at) VALUES (?, ?, ?)');
    const insertMsg = db.prepare(
      `INSERT INTO messages (conversation_id, direction, kind, channel, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    convSpecs.forEach(([clientIdx, channel, msgs]) => {
      const convInfo = insertConv.run(clientIds[clientIdx], channel, msgs[msgs.length - 1][3]);
      const convId = Number(convInfo.lastInsertRowid);
      msgs.forEach(([direction, kind, body, at], idx) => {
        const unread = direction === 'in' && idx === msgs.length - 1 ? 1 : 0;
        insertMsg.run(convId, direction, kind, channel, body, direction === 'in' ? (unread ? 0 : 1) : 1, at);
      });
    });

    /* notifications */
    const notifications = [
      ['booking', 'Новая заявка на съёмку', 'Мария Лебедева · Love story, сегодня в 15:30', 'Открыть запись', '/admin/bookings', 0],
      ['message', 'Новое сообщение', 'Мария Лебедева: «А подскажите, где именно встречаемся?»', 'Открыть чат', '/admin/messages', 0],
      ['booking', 'Заявка ждёт подтверждения', 'Павел Никитин · Мини-съёмка, 2 дня', 'Открыть запись', '/admin/bookings', 0],
      ['review', 'Новый отзыв', 'Ольга Морозова оставила отзыв о съёмке', 'Посмотреть', '/admin/reviews', 1],
      ['system', 'Сертификат истекает', 'Подарочный сертификат на 8 000 ₽ истекает через 3 дня', 'Открыть маркетинг', '/admin/marketing/certificates', 1]
    ];
    const insertNotif = db.prepare(
      `INSERT INTO notifications (kind, title, subtitle, action_label, action_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    notifications.forEach(([kind, title, subtitle, label, url, read], i) => {
      insertNotif.run(kind, title, subtitle, label, url, read, iso(0, 9, 10 + i * 7));
    });

    /* маркетинг: скидки, промокоды, сертификаты */
    const insertDiscount = db.prepare(
      `INSERT INTO discounts (name, kind, value, scope, item_ids, min_amount, audience, auto, stackable,
                              priority, starts_on, ends_on, is_active, used_count, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const discounts = [
      ['Первый визит', 'percent', 10, 'all', '[]', 0, 'new', 1, 10, dayKey(-30), dayKey(60), 1, 4, 'Мягкий вход для новых клиентов'],
      ['Пакет из трёх съёмок', 'percent', 15, 'all', '[]', 15000, 'all', 1, 20, null, null, 1, 2, 'Действует от 15 000 ₽'],
      ['Скидка на семейную съёмку', 'fixed', 2000, 'service', JSON.stringify([3]), 0, 'all', 1, 5, null, dayKey(45), 1, 3, null],
      ['Летняя акция Love story', 'percent', 12, 'package', JSON.stringify([1]), 0, 'repeat', 0, 0, dayKey(-90), dayKey(-10), 0, 0, 'Архивная акция']
    ];
    discounts.forEach(([name, kind, value, scope, itemIds, min, audience, auto, priority, from, to, active, used, note]) => {
      insertDiscount.run(name, kind, value, scope, itemIds, min, audience, auto, priority, from, to, active, used, note, iso(-40, 10, 0), iso(-10, 10, 0));
    });

    const insertCoupon = db.prepare(
      `INSERT INTO coupons (code, title, kind, value, discount_id, limit_total, limit_per_client, used_count,
                            min_amount, starts_on, ends_on, is_active, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const coupons = [
      ['SPRING15', 'Весенняя скидка', 'percent', 15, null, 50, 1, 12, 0, dayKey(-60), dayKey(30), 1, 'Рассылка в Telegram'],
      ['LOVE2000', 'Скидка на Love story', 'fixed', 2000, null, 20, 1, 5, 0, dayKey(-20), null, 1, null],
      ['FAMILY10', 'Семейная съёмка', 'percent', 10, 3, 0, 2, 3, 0, null, dayKey(90), 1, 'Для постоянных клиентов'],
      ['REFERRAL500', 'За рекомендацию', 'fixed', 500, null, 100, 1, 100, 0, dayKey(-180), dayKey(-120), 0, 'Старая кампания']
    ];
    coupons.forEach(([code, title, kind, value, discountId, limitTotal, limitPerClient, used, min, from, to, active, note]) => {
      insertCoupon.run(code, title, kind, value, discountId, limitTotal, limitPerClient, used, min, from, to, active, note, iso(-50, 11, 0), iso(-5, 11, 0));
    });

    const insertCertificate = db.prepare(
      `INSERT INTO certificates (code, kind, amount, remaining, service_id, recipient, phone, email,
                                 purchased_at, expires_at, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const certificates = [
      ['GIFT-8K00-XMAS', 'amount', 8000, 8000, null, 'Ольга Морозова', '+375 29 441-22-08', 'olga.m@gmail.com', dayKey(-25), dayKey(3), 'active', 'Подарок на день рождения'],
      ['GIFT-LOVE-24', 'service', 6500, 6500, 2, 'Мария Лебедева', '+375 33 705-91-14', 'm.lebedeva@gmail.com', dayKey(-40), dayKey(120), 'active', null],
      ['GIFT-5K-NEWY', 'amount', 5000, 2000, null, 'Сергей Мельник', '+375 33 508-92-61', null, dayKey(-90), dayKey(180), 'active', 'Часть уже потрачена'],
      ['GIFT-OLD-2025', 'amount', 4000, 4000, null, 'Павел Никитин', null, null, dayKey(-400), dayKey(-40), 'active', null]
    ];
    certificates.forEach(([code, kind, amount, remaining, serviceId, recipient, phone, email, purchased, expires, status, note]) => {
      insertCertificate.run(code, kind, amount, remaining, serviceId, recipient, phone, email, purchased, expires, status, note, iso(-30, 12, 0), iso(-3, 12, 0));
    });

    /* activity log */
    const activity = [
      ['booking', 'Новая заявка от Марии Лебедевой', 'Love story · сегодня, 15:30', 'booking', 2],
      ['message', 'Сообщение в Telegram', 'Мария Лебедева ответила в чате', 'conversation', 1],
      ['status', 'Статус изменён', 'Анна Ковалёва · Завершена → Обработка', 'booking', 9],
      ['booking', 'Запись перенесена', 'Дмитрий Орлов · +1 день', 'booking', 3],
      ['client', 'Клиент добавлен в VIP', 'Елена Соколова', 'client', 4],
      ['discount', 'Применён промокод', 'SPRING15 · скидка 15%', 'booking', 12],
      ['gallery', 'Ссылка на галерею добавлена', 'Анна Ковалёва · Яндекс Диск', 'booking', 10],
      ['review', 'Отзыв одобрен', 'Ольга Морозова · 5 из 5', 'review', 1]
    ];
    const insertActivity = db.prepare(
      `INSERT INTO activity_log (type, title, description, entity, entity_id, actor, created_at) VALUES (?, ?, ?, ?, ?, 'photographer', ?)`
    );
    activity.forEach(([type, title, description, entity, entityId], i) => {
      insertActivity.run(type, title, description, entity, entityId, iso(-i, 12, 0));
    });
  });

  seed();
  console.log('[seed] demo studio created:', DEMO_EMAIL, '/', DEMO_PASSWORD);
  return true;
}

export function seedIfEmpty() {
  try {
    return ensureSeed();
  } catch (err) {
    console.error('[seed] failed', err);
    return false;
  }
}

export { getSettings };
