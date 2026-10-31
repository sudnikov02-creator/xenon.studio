/**
 * Vercel serverless entry.
 * `vercel.json` rewrites every /api/* request here while keeping the original URL,
 * so Express sees exactly the path the client asked for. The app is created once
 * per warm instance, which also keeps the SQLite file in /tmp shared between calls.
 */
import { createApp } from '../server/app.js';

const app = createApp({ serveStatic: false });

export default function handler(req, res) {
  return app(req, res);
}
