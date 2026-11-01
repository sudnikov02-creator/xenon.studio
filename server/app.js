import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { seedIfEmpty } from './lib/seed.js';
import { purgeExpiredSessions } from './lib/auth.js';
import { initPush } from './lib/push.js';
import { broadcast } from './lib/sse.js';
import { onActivityLogged } from './db.js';
import { ensureTemplates, tick } from './lib/automation.js';

import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import realtimeRoutes from './routes/realtime.js';
import pushRoutes from './routes/push.js';
import publicRoutes from './routes/public.js';
import dashboardRoutes from './routes/dashboard.js';
import bookingRoutes from './routes/bookings.js';
import servicesRoutes from './routes/services.js';
import bookingFormRoutes from './routes/booking-form.js';
import bookingPageRoutes from './routes/booking-page.js';
import statusesRoutes from './routes/statuses.js';
import clientsRoutes from './routes/clients.js';
import messagesRoutes from './routes/messages.js';
import marketingRoutes from './routes/marketing.js';
import automationRoutes from './routes/automation.js';
import calendarRoutes, { icsFeedHandler } from './routes/calendar.js';
import analyticsRoutes from './routes/analytics.js';
import activityRoutes from './routes/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const hasBuild = fs.existsSync(distDir);

/** Serverless (Vercel) keeps a single warm instance: skip the periodic sweeps there. */
const SERVERLESS = Boolean(process.env.VERCEL);

let initialized = false;

/* Журнал действий обновляется в открытой панели так же живо, как остальные разделы. */
onActivityLogged((payload) => broadcast('activity', payload));

let lastAutomationTick = 0;

/* Сценарии по времени проверяются не чаще раза в пять минут — и на serverless,
   где интервала нет, достаточно первого же запроса к API. */
function maybeTickAutomation() {
  const now = Date.now();
  if (now - lastAutomationTick < 5 * 60 * 1000) return;
  lastAutomationTick = now;
  try {
    tick();
  } catch (err) {
    console.error('[automation] tick failed:', err?.message || err);
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;
  seedIfEmpty();
  purgeExpiredSessions();
  initPush();
  ensureTemplates();
  if (!SERVERLESS) {
    setInterval(purgeExpiredSessions, 6 * 3600 * 1000).unref?.();
    setInterval(maybeTickAutomation, 5 * 60 * 1000).unref?.();
  }
}

export function createApp({ serveStatic = true } = {}) {
  initialize();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', (req, res, next) => {
    maybeTickAutomation();
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'xenon.studio', time: new Date().toISOString() });
  });

  /* Подписка Apple Calendar: ссылка с секретным токеном, без входа в систему. */
  app.get('/api/public/calendar/:token.ics', icsFeedHandler);

  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/public', bookingFormRoutes);
  app.use('/api/public', bookingPageRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/statuses', statusesRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/marketing', marketingRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api', servicesRoutes);
  app.use('/api', realtimeRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Метод API не найден' });
  });

  /* ---------- production: serve the built SPA ---------- */
  if (serveStatic && hasBuild) {
    app.use(
      express.static(distDir, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, file) => {
          if (file.endsWith('sw.js') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        }
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error('[api error]', err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: 'server_error', message: 'Внутренняя ошибка сервера' });
  });

  return app;
}
