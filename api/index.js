/**
 * Vercel entry for rewritten /api/* requests.
 * Proxy behaviour probing is over — this app answers with Express.
 */
import { createApp } from '../server/app.js';

const app = createApp({ serveStatic: false });

export default function handler(req, res) {
  res.status(200).json({
    diag: true,
    url: req.url,
    query: req.query,
    headers: {
      'x-vercel-original-path': req.headers['x-vercel-original-path'] || null,
      'x-original-url': req.headers['x-original-url'] || null,
      'x-rewrite-url': req.headers['x-rewrite-url'] || null,
      'x-forwarded-uri': req.headers['x-forwarded-uri'] || null,
      'x-matched-path': req.headers['x-matched-path'] || null,
      host: req.headers.host || null
    }
  });
}
