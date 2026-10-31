import webpush from 'web-push';
import { db } from '../db.js';

let publicKey = null;
let privateKey = null;
let ready = false;

function loadOrCreateKeys() {
  /* Fixed keys (required on serverless hosts, where /tmp is wiped between cold starts). */
  const envPublic = process.env.XENON_VAPID_PUBLIC;
  const envPrivate = process.env.XENON_VAPID_PRIVATE;
  if (envPublic && envPrivate) {
    publicKey = envPublic;
    privateKey = envPrivate;
    return;
  }
  const row = db.prepare("SELECT value FROM lookups WHERE kind = 'vapid' ORDER BY id LIMIT 1").get();
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      publicKey = parsed.publicKey;
      privateKey = parsed.privateKey;
      return;
    } catch {
      /* regenerate below */
    }
  }
  const keys = webpush.generateVAPIDKeys();
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
  db.prepare("INSERT INTO lookups (kind, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
}

export function initPush() {
  try {
    loadOrCreateKeys();
    webpush.setVapidDetails('mailto:studio@xenon.studio', publicKey, privateKey);
    ready = true;
  } catch (err) {
    console.warn('[push] disabled:', err.message);
    ready = false;
  }
}

export function pushPublicKey() {
  return ready ? publicKey : null;
}

export function saveSubscription(sub, audience = 'photographer') {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return false;
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, audience) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, audience = excluded.audience`
  ).run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, audience);
  return true;
}

export function removeSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

export async function sendPush(payload, audience = 'photographer') {
  if (!ready) return { sent: 0 };
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE audience = ?').all(audience);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) removeSubscription(sub.endpoint);
    }
  }
  return { sent };
}

export function subscriptionCount(audience = 'photographer') {
  return db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE audience = ?').get(audience).n;
}
