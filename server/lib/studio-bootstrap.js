import { db, getSettings, saveSettings } from '../db.js';

/** Базовые статусы новой студии: с них начинается любая установка. */
export const DEFAULT_STATUSES = [
  { name: 'Заявка', color: '#f59e0b', isInitial: 1, isFinal: 0, isCancelled: 0, canReschedule: 1, canCancel: 1, order: 10 },
  { name: 'Подтверждена', color: '#2563eb', isInitial: 0, isFinal: 0, isCancelled: 0, canReschedule: 1, canCancel: 1, order: 20 },
  { name: 'Съёмка проведена', color: '#8b5cf6', isInitial: 0, isFinal: 0, isCancelled: 0, canReschedule: 0, canCancel: 0, order: 30 },
  { name: 'Обработка', color: '#0ea5e9', isInitial: 0, isFinal: 0, isCancelled: 0, canReschedule: 0, canCancel: 0, order: 40 },
  { name: 'Завершена', color: '#16a34a', isInitial: 0, isFinal: 1, isCancelled: 0, canReschedule: 0, canCancel: 1, order: 50 },
  { name: 'Отклонена', color: '#ef4444', isInitial: 0, isFinal: 0, isCancelled: 1, canReschedule: 0, canCancel: 0, order: 900 }
];

/**
 * Готовит студию к работе после регистрации фотографа: настройки по умолчанию
 * и базовую цепочку статусов. Вызывается один раз и не перезаписывает уже существующие данные.
 */
export function bootstrapStudio({ photographerName = '', siteName = '', contacts = null } = {}) {
  const hasStatuses = db.prepare('SELECT COUNT(*) AS n FROM statuses WHERE deleted_at IS NULL').get().n > 0;
  if (!hasStatuses) {
    const insert = db.prepare(
      `INSERT INTO statuses (name, color, sort_order, is_initial, is_final, is_cancelled,
                             client_can_reschedule, client_can_cancel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const commit = db.transaction(() => {
      for (const status of DEFAULT_STATUSES) {
        insert.run(
          status.name,
          status.color,
          status.order,
          status.isInitial,
          status.isFinal,
          status.isCancelled,
          status.canReschedule,
          status.canCancel
        );
      }
    });
    commit();
  }

  const settings = getSettings();
  const patch = {};
  // Имя из регистрации становится именем фотографа в студии (его можно изменить в профиле).
  if (photographerName) patch.photographerName = photographerName;
  if (siteName && !settings.siteName) patch.siteName = siteName;
  if (contacts && !settings.contacts?.phone && !settings.contacts?.email) patch.contacts = contacts;
  if (Object.keys(patch).length > 0) saveSettings(patch);

  return { statuses: db.prepare('SELECT COUNT(*) AS n FROM statuses').get().n };
}

/** Есть ли уже фотограф — от этого зависит, показывать вход или первый запуск. */
export function hasPhotographer() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
}
