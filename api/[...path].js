/**
 * Vercel serverless entry — every /api/* request lands here (catch-all route).
 * The Express app is created once per warm instance, so SQLite in /tmp stays shared.
 */
import { createApp } from '../server/app.js';

const app = createApp({ serveStatic: false });

export default function handler(req, res) {
  let url = req.url || '/';

  if (!url.startsWith('/api')) {
    const queryIndex = url.indexOf('?');
    const search = queryIndex >= 0 ? url.slice(queryIndex) : '';
    const bare = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
    const segments = req.query?.path;
    const suffix = Array.isArray(segments)
      ? segments.join('/')
      : typeof segments === 'string'
        ? segments
        : bare.replace(/^\/+/, '');
    url = `/api/${suffix}${search}`;
  }

  req.url = url;
  return app(req, res);
}
