import { db } from '../db.js';

/** Server-Sent Events hub: one channel per logged-in photographer session. */
const clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 4000\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);

  const client = { res, userId: req.user.id };
  clients.add(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 25000);

  function cleanup() {
    clearInterval(heartbeat);
    clients.delete(client);
  }

  req.on('close', cleanup);
  req.on('error', cleanup);
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function badges() {
  const unreadNotifications = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE is_read = 0').get().n;
  const unreadMessages = db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE direction = 'in' AND is_read = 0")
    .get().n;
  const pendingBookings = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b
       JOIN statuses s ON s.id = b.status_id
       WHERE b.deleted_at IS NULL AND s.is_initial = 1`
    )
    .get().n;
  return { unreadNotifications, unreadMessages, pendingBookings };
}

export function broadcastBadges() {
  broadcast('badges', badges());
}

export function connectionCount() {
  return clients.size;
}

/* ------------------------------------------------------------------ */
/*  Канал клиента: одна запись — одна ссылка /b/:code                  */
/* ------------------------------------------------------------------ */

const bookingChannels = new Map();

/** SSE для публичной страницы записи: клиент подписывается по коду ссылки. */
export function bookingStreamHandler(req, res, code) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 5000\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);

  const key = String(code || '').toUpperCase();
  const subscribed = { res };
  if (!bookingChannels.has(key)) bookingChannels.set(key, new Set());
  bookingChannels.get(key).add(subscribed);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, 25000);

  function cleanup() {
    clearInterval(heartbeat);
    const set = bookingChannels.get(key);
    if (set) {
      set.delete(subscribed);
      if (set.size === 0) bookingChannels.delete(key);
    }
  }

  req.on('close', cleanup);
  req.on('error', cleanup);
}

export function broadcastToBooking(code, data) {
  const key = String(code || '').toUpperCase();
  const set = bookingChannels.get(key);
  if (!set || set.size === 0) return 0;
  const payload = `event: booking\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of set) {
    try {
      client.res.write(payload);
    } catch {
      set.delete(client);
    }
  }
  return set.size;
}

/** Сообщить открытой у клиента странице, что запись изменилась. */
export function broadcastBookingUpdate(bookingId, payload = {}) {
  const row = db.prepare('SELECT public_code FROM bookings WHERE id = ?').get(Number(bookingId));
  if (!row) return 0;
  return broadcastToBooking(row.public_code, { id: Number(bookingId), at: Date.now(), ...payload });
}
