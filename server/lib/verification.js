import crypto from 'node:crypto';
import { db } from '../db.js';

const CODE_TTL_MIN = 10;
const TOKEN_TTL_MIN = 40;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function prettyPhone(digits) {
  const clean = String(digits || '');
  if (clean.length === 12 && clean.startsWith('375')) {
    return `+375 ${clean.slice(3, 5)} ${clean.slice(5, 8)}-${clean.slice(8, 10)}-${clean.slice(10, 12)}`;
  }
  if (clean.length === 11 && clean.startsWith('7')) {
    return `+7 ${clean.slice(1, 4)} ${clean.slice(4, 7)}-${clean.slice(7, 9)}-${clean.slice(9, 11)}`;
  }
  return `+${clean}`;
}

function sixDigits() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Демо-режим: реального SMS-провайдера нет, поэтому код пишется в лог и (если включено)
 * возвращается клиенту. Подключение провайдера — одна функция sendCode().
 */
export function demoMode() {
  return process.env.XENON_DEMO !== '0';
}

function sendCode(phone, code) {
  console.log(`[verify] код подтверждения для ${prettyPhone(phone)}: ${code}`);
}

export function lastRequest(phone) {
  return db
    .prepare('SELECT * FROM phone_verifications WHERE phone = ? ORDER BY id DESC LIMIT 1')
    .get(phone);
}

function asDate(value) {
  const text = String(value || '');
  return new Date(text.endsWith('Z') ? text : `${text}Z`);
}

export function secondsUntilResend(phone) {
  const row = lastRequest(phone);
  if (!row) return 0;
  const age = (Date.now() - asDate(row.created_at).getTime()) / 1000;
  if (!Number.isFinite(age)) return 0;
  return Math.max(0, Math.ceil(RESEND_SECONDS - age));
}

export function startVerification(phone) {
  const code = sixDigits();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString();
  db.prepare('DELETE FROM phone_verifications WHERE phone = ? AND verified_at IS NULL').run(phone);
  db.prepare(
    `INSERT INTO phone_verifications (phone, code, attempts, expires_at, created_at)
     VALUES (?, ?, 0, ?, ?)`
  ).run(phone, code, expiresAt, new Date().toISOString());
  sendCode(phone, code);
  return {
    phone: prettyPhone(phone),
    expiresAt,
    resendAfterSec: RESEND_SECONDS,
    devCode: demoMode() ? code : undefined
  };
}

export function confirmVerification(phone, code) {
  const row = db
    .prepare('SELECT * FROM phone_verifications WHERE phone = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(phone);
  if (!row) {
    return { error: 'code_not_requested', message: 'Сначала запросите код подтверждения' };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: 'code_expired', message: 'Код устарел — запросите новый' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { error: 'too_many_attempts', message: 'Слишком много попыток. Запросите новый код' };
  }
  if (String(code || '').trim() !== row.code) {
    db.prepare('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    const left = Math.max(0, MAX_ATTEMPTS - row.attempts - 1);
    return {
      error: 'code_invalid',
      message: left > 0 ? `Неверный код. Осталось попыток: ${left}` : 'Попытки закончились. Запросите новый код'
    };
  }

  const token = crypto.randomBytes(24).toString('hex');
  const verifiedUntil = new Date(Date.now() + TOKEN_TTL_MIN * 60000).toISOString();
  db.prepare('UPDATE phone_verifications SET verified_at = ?, token = ?, expires_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    token,
    verifiedUntil,
    row.id
  );
  return { token, phone: prettyPhone(phone), expiresAt: verifiedUntil };
}

/** Токен одноразовый: после успешной записи он помечается использованным. */
export function checkToken(phone, token) {
  if (!token) return false;
  const row = db
    .prepare('SELECT * FROM phone_verifications WHERE phone = ? AND token = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(phone, String(token));
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  return true;
}

export function consumeToken(phone, token) {
  db.prepare('UPDATE phone_verifications SET used_at = ? WHERE phone = ? AND token = ?').run(
    new Date().toISOString(),
    phone,
    String(token)
  );
}

export function purgeVerifications() {
  const cutoff = new Date(Date.now() - 2 * 86400000).toISOString();
  db.prepare('DELETE FROM phone_verifications WHERE created_at < ?').run(cutoff);
}
