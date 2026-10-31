import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { seedIfEmpty } from './lib/seed.js';
import { purgeExpiredSessions } from './lib/auth.js';
import { initPush } from './lib/push.js';

import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import realtimeRoutes from './routes/realtime.js';
import pushRoutes from './routes/push.js';
import publicRoutes from './routes/public.js';
import dashboardRoutes from './routes/dashboard.js';
import bookingRoutes from './routes/bookings.js';
import servicesRoutes from './routes/services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const hasBuild = fs.existsSync(distDir);

/** Serverless (Vercel) keeps a single warm instance: skip the periodic sweeps there. */
const SERVERLESS = Boolean(process.env.VERCEL);

let initialized = false;

function initialize() {
  if (initialized) return;
  initialized = true;
  seedIfEmpty();
  purgeExpiredSessions();
  initPush();
  if (!SERVERLESS) setInterval(purgeExpiredSessions, 6 * 3600 * 1000).unref?.();
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

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'xenon.studio', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/bookings', bookingRoutes);
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
