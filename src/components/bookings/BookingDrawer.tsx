import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  CreditCard,
  History,
  Image,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  Save,
  StickyNote,
  Trash2,
  TriangleAlert,
  User,
  XCircle
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { BookingStatusPill } from './BookingStatusPill';
import { BookingTimeline } from './BookingTimeline';
import { RescheduleModal } from './RescheduleModal';
import { CancelBookingModal } from './CancelBookingModal';
import { api, ApiError } from '../../lib/api';
import { formatDayLabel, formatMoney, formatTimeIn, initials } from '../../lib/utils';
import { formatDuration } from '../../lib/services';
import type { BookingDetail, BookingStatusInfo, BookingSummary } from '../../types';

export function BookingDrawer({
  bookingId,
  statuses,
  timezone,
  currencySymbol,
  decimalSeparator,
  onClose,
  onChanged,
  onDeleted
}: {
  bookingId: number | null;
  statuses: BookingStatusInfo[];
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [gallery, setGallery] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const open = bookingId !== null;

  const load = useCallback(async (id: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<BookingDetail>(`/bookings/${id}`);
      setDetail(data);
      setNotes(data.booking.notes || '');
      setGallery(data.booking.galleryUrl || '');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось открыть запись');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bookingId === null) {
      setDetail(null);
      setError(null);
      return;
    }
    void load(bookingId);
  }, [bookingId, load]);

  const booking: BookingSummary | null = detail?.booking || null;

  const otherStatuses = useMemo(
    () => statuses.filter((status) => status.id !== booking?.status?.id),
    [statuses, booking?.status?.id]
  );

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      if (bookingId !== null) await load(bookingId, true);
      onChanged();
      return message;
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось выполнить действие');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (statusId: number) =>
    void runAction(() => api.post(`/bookings/${bookingId}/status`, { statusId }), 'Статус обновлён');

  const saveNotes = async () => {
    setSavingNotes(true);
    setActionError(null);
    try {
      await api.patch(`/bookings/${bookingId}`, { notes: notes.trim(), galleryUrl: gallery.trim() });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось сохранить заметку');
    } finally {
      setSavingNotes(false);
    }
  };

  const cancelBooking = async (comment: string) => {
    const done = await runAction(
      () => api.post(`/bookings/${bookingId}/cancel`, { comment }),
      'Запись отменена'
    );
    if (done) setCancelOpen(false);
  };

  const removeBooking = async () => {
    setBusy(true);
    try {
      await api.del(`/bookings/${bookingId}`);
      setDeleteOpen(false);
      onDeleted();
      onClose();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось удалить запись');
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!booking) return;
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/b/${booking.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const addons = booking?.addons || [];
  const addonsTotal = addons.reduce((sum, addon) => sum + (addon.price || 0) * (addon.qty || 1), 0);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="wide"
        title={booking ? booking.client?.name || 'Клиент' : 'Запись'}
        subtitle={
          booking
            ? `${formatDayLabel(booking.startsAt, timezone)} · ${formatTimeIn(booking.startsAt, timezone)} · ${formatDuration(
                booking.duration
              )}`
            : undefined
        }
        icon={booking?.client ? <span className="bd-avatar">{initials(booking.client.name)}</span> : <CalendarDays />}
        className="overlay--drawer"
        footer={
          <div className="bd-foot">
            <button
              type="button"
              className="btn btn--ghost bd-delete"
              onClick={() => setDeleteOpen(true)}
              disabled={busy || !booking}
            >
              <Trash2 /> <span>Удалить</span>
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="btn"
              onClick={() => setCancelOpen(true)}
              disabled={busy || !booking || booking.status?.isCancelled}
            >
              <XCircle /> Отменить
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setRescheduleOpen(true)}
              disabled={busy || !booking}
            >
              <CalendarClock /> Перенести
            </button>
          </div>
        }
      >
        {loading && !detail && (
          <div className="bd-loading">
            <span className="skeleton" style={{ height: 66, borderRadius: 14 }} />
            <span className="skeleton" style={{ height: 148, borderRadius: 14, marginTop: 12 }} />
            <span className="skeleton" style={{ height: 102, borderRadius: 14, marginTop: 12 }} />
          </div>
        )}

        {error && !detail && (
          <div className="bd-error">
            <TriangleAlert />
            <div>
              <b>Не удалось открыть</b>
              <span>{error}</span>
            </div>
            {bookingId !== null && (
              <button type="button" className="btn btn--sm" onClick={() => void load(bookingId)}>
                Повторить
              </button>
            )}
          </div>
        )}

        {detail && booking && (
          <div className="bd">
            <div className="bd__top">
              <div className="bd__status">
                <BookingStatusPill status={booking.status} />
                <span className="bd__code">
                  <Link2 /> /b/{booking.code}
                  <button type="button" onClick={() => void copyLink()} aria-label="Скопировать ссылку">
                    {copied ? <Check /> : <Copy />}
                  </button>
                </span>
              </div>
              <div className="bd__price-block">
                <span>Стоимость</span>
                <b className="tnum">{formatMoney(booking.price, currencySymbol, decimalSeparator)}</b>
              </div>
            </div>

            <div className="bd__facts">
              <div className="bd-fact">
                <span className="bd-fact__icon">
                  <CalendarDays />
                </span>
                <div>
                  <em>Когда</em>
                  <b>{formatDayLabel(booking.startsAt, timezone)}</b>
                  <span>
                    {formatTimeIn(booking.startsAt, timezone)} · {formatDuration(booking.duration)}
                  </span>
                </div>
              </div>
              <div className="bd-fact">
                <span className="bd-fact__icon">
                  <CreditCard />
                </span>
                <div>
                  <em>Что снимаем</em>
                  <b>{detail.service?.name || detail.package?.name || 'Съёмка'}</b>
                  <span>
                    {booking.package
                      ? detail.package?.services.map((item) => item.name).join(' + ') || 'Пакет услуг'
                      : detail.service?.description || 'Услуга студии'}
                  </span>
                </div>
              </div>
              <div className="bd-fact">
                <span className="bd-fact__icon">
                  <User />
                </span>
                <div>
                  <em>Источник</em>
                  <b>{detail.source === 'client' ? 'Заявка с сайта' : 'Создана вручную'}</b>
                  <span>{booking.createdAt ? `добавлена ${formatDayLabel(booking.createdAt, timezone)}` : '—'}</span>
                </div>
              </div>
            </div>

            {actionError && (
              <div className="bd__alert" role="alert">
                <TriangleAlert /> {actionError}
              </div>
            )}

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>Сменить статус</h4>
                <span>История сохраняется в карточке</span>
              </header>
              <div className="bd__statuses">
                {otherStatuses.map((status) => (
                  <button
                    type="button"
                    key={status.id}
                    className="bd__status-btn"
                    disabled={busy}
                    onClick={() => void changeStatus(status.id)}
                  >
                    <BookingStatusPill status={status} size="sm" />
                    <ArrowUpRight />
                  </button>
                ))}
              </div>
            </section>

            {detail.client && (
              <section className="bd__section">
                <header className="bd__section-head">
                  <h4>Контакты</h4>
                  {detail.client.isVip && <span className="badge badge--warning">VIP</span>}
                </header>
                <div className="bd__contacts">
                  {detail.client.phone && (
                    <a className="bd-contact" href={`tel:${detail.client.phone.replace(/[^\d+]/g, '')}`}>
                      <Phone />
                      <span>{detail.client.phone}</span>
                    </a>
                  )}
                  {detail.client.email && (
                    <a className="bd-contact" href={`mailto:${detail.client.email}`}>
                      <Mail />
                      <span>{detail.client.email}</span>
                    </a>
                  )}
                  {detail.client.telegram && (
                    <a
                      className="bd-contact"
                      href={`https://t.me/${detail.client.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle />
                      <span>@{detail.client.telegram.replace('@', '')}</span>
                    </a>
                  )}
                  {detail.client.notes && <p className="bd__client-note">{detail.client.notes}</p>}
                </div>
              </section>
            )}

            {(addons.length > 0 || detail.clientNote) && (
              <section className="bd__section">
                <header className="bd__section-head">
                  <h4>Дополнения</h4>
                  {addonsTotal > 0 && (
                    <span className="tnum">+{formatMoney(addonsTotal, currencySymbol, decimalSeparator)}</span>
                  )}
                </header>
                {addons.length > 0 ? (
                  <ul className="bd__addons">
                    {addons.map((addon) => (
                      <li key={addon.id}>
                        <span>{addon.name}</span>
                        {addon.qty && addon.qty > 1 ? <em>× {addon.qty}</em> : null}
                        <b className="tnum">
                          {formatMoney((addon.price || 0) * (addon.qty || 1), currencySymbol, decimalSeparator)}
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="bd-empty-note">Дополнений нет — только базовая съёмка.</p>
                )}
                {detail.clientNote && (
                  <div className="bd__wish">
                    <StickyNote />
                    <span>{detail.clientNote}</span>
                  </div>
                )}
              </section>
            )}

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>Заметки и галерея</h4>
                <span>Видно только вам</span>
              </header>
              <label className="field">
                <span className="field__label">Заметка к съёмке</span>
                <textarea
                  className="textarea"
                  rows={3}
                  maxLength={1200}
                  value={notes}
                  placeholder="Что взять на съёмку, пожелания, договорённости"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">
                  <Image /> Ссылка на галерею
                </span>
                <input
                  className="input"
                  value={gallery}
                  placeholder="https://disk.yandex.ru/…"
                  onChange={(event) => setGallery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`btn btn--soft btn--sm bd__save${savingNotes ? ' btn--loading' : ''}`}
                onClick={() => void saveNotes()}
                disabled={savingNotes}
              >
                {savedFlash ? <Check /> : <Save />}
                {savedFlash ? 'Сохранено' : 'Сохранить'}
              </button>
            </section>

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>
                  <History /> История
                </h4>
                <span>{detail.events.length} событий</span>
              </header>
              <BookingTimeline events={detail.events} timezone={timezone} />
            </section>
          </div>
        )}
      </Modal>

      <RescheduleModal
        booking={booking}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onDone={async (id) => {
          await load(id, true);
          onChanged();
        }}
      />

      <CancelBookingModal
        booking={booking}
        open={cancelOpen}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onSubmit={(comment) => void cancelBooking(comment)}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Удалить запись?"
        message={
          <span>
            Запись «{booking?.client?.name || 'клиент'}» от {booking?.localDate} уйдёт в корзину. Клиент и
            история событий останутся в базе.
          </span>
        }
        confirmLabel="Удалить запись"
        busy={busy}
        icon={<Clock3 />}
        onConfirm={() => void removeBooking()}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
