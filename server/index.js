import { createApp } from './app.js';
import { db } from './db.js';
import { purgeVerifications } from './lib/verification.js';

const PORT = Number(process.env.PORT || 3001);
const app = createApp();

purgeVerifications();
setInterval(purgeVerifications, 12 * 3600 * 1000).unref?.();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[xenon.studio] API listening on http://0.0.0.0:${PORT}`);
});

function shutdown(signal) {
  console.log(`[xenon.studio] ${signal} received, closing`);
  server.close(() => {
    try {
      db.close();
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 4000).unref?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
