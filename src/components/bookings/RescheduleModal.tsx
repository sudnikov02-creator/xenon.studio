import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api, ApiError } from '../../lib/api';
import { formatMonthTitle, plural } from '../../lib/utils';
import { WEEKDAY_SHORT, dayNumber, formatLongDate, monthCells, shiftMonth } from '../../lib/booking';
import type { BookingMonthPayload, BookingSlotsPayload, BookingSummary } from '../../types';

export function RescheduleModal({
  booking,
  open,
  onClose,
  onDone
}: {
  booking: BookingSummary | null;
  open: boolean;
  onClose: () => void;
  onDone: (bookingId: number) => void;
}) {
  const [month, setMonth] = useState('');
  const [days, setDays] = useState<Record<string, { count: number; first: string; last: string }>>({});
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<BookingSlotsPayload | null>(null);
  const [comment, setComment] = useState('');
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingId = booking?.id ?? null;

  const loadMonth = useCallback(
    async (target: string) => {
      if (!bookingId) return;
      setLoadingMonth(true);
      try {
        let data = await api.get<BookingMonthPayload>(`/bookings/${bookingId}/availability?month=${target}`);
        // Если в этом месяце свободных дней нет (например, запись была давно) — сразу показываем следующий.
        if (Object.keys(data.days).length === 0) {
          data = await api.get<BookingMonthPayload>(
            `/bookings/${bookingId}/availability?month=${shiftMonth(target, 1)}`
          );
        }
        setDays(data.days);
        setToday(data.today);
        setMonth(data.month);
      } catch {
        setDays({});
      } finally {
        setLoadingMonth(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    if (!open || !bookingId) return;
    setDate('');
    setTime('');
    setSlots(null);
    setComment('');
    setError(null);
    // Перенос почти всегда вперёд — открываем текущий месяц, а не месяц исходной записи.
    void loadMonth(new Date().toISOString().slice(0, 7));
  }, [open, bookingId, loadMonth]);

  useEffect(() => {
    if (!open || !bookingId || !date) return;
    let alive = true;
    setLoadingSlots(true);
    setTime('');
    api
      .get<BookingSlotsPayload>(`/bookings/${bookingId}/slots?date=${date}`)
      .then((data) => {
        if (alive) setSlots(data);
      })
      .catch(() => {
        if (alive) setSlots(null);
      })
      .finally(() => {
        if (alive) setLoadingSlots(false);
      });
    return () => {
      alive = false;
    };
  }, [open, bookingId, date]);

  const cells = useMemo(() => (month ? monthCells(month) : []), [month]);

  const submit = async () => {
    if (!bookingId || !date || !time) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/reschedule`, { date, time, comment: comment.trim() });
      onDone(bookingId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось перенести запись');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Перенести запись"
      subtitle={booking ? `${booking.client?.name || 'Клиент'} · сейчас ${booking.localDate}` : ''}
      icon={<CalendarClock />}
      size="medium"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            onClick={() => void submit()}
            disabled={saving || !date || !time}
          >
            Перенести{date && time ? ` на ${time}` : ''}
          </button>
        </>
      }
    >
      <div className="resched">
        <div className="resched__cal">
          <div className="resched__cal-head">
            <b>{formatMonthTitle(month || new Date().toISOString().slice(0, 7))}</b>
            <div className="resched__nav">
              <button
                type="button"
                className="btn btn--icon btn--bordered"
                aria-label="Предыдущий месяц"
                onClick={() => month && void loadMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                className="btn btn--icon btn--bordered"
                aria-label="Следующий месяц"
                onClick={() => month && void loadMonth(shiftMonth(month, 1))}
              >
                <ChevronRight />
              </button>
            </div>
          </div>

          <div className="resched__weekdays">
            {WEEKDAY_SHORT.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="resched__grid" data-loading={loadingMonth || undefined}>
            {cells.map((key, index) => {
              if (!key) return <span className="resched__blank" key={`blank-${index}`} />;
              const info = days[key];
              return (
                <button
                  type="button"
                  key={key}
                  className="resched__cell"
                  data-free={Boolean(info) || undefined}
                  data-today={key === today || undefined}
                  data-selected={key === date || undefined}
                  disabled={!info}
                  onClick={() => setDate(key)}
                  aria-pressed={key === date}
                >
                  {dayNumber(key)}
                  {info && <i aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="resched__slots">
          <div className="resched__slots-head">
            <b>{date ? formatLongDate(date) : 'Выберите день'}</b>
            <span>
              {slots && slots.slots.length > 0
                ? `${slots.slots.length} ${plural(slots.slots.length, 'слот', 'слота', 'слотов')}`
                : 'свободное время'}
            </span>
          </div>

          {!date && (
            <div className="resched__hint">
              <Clock3 />
              <span>Дни с точкой — есть свободное время.</span>
            </div>
          )}

          {date && loadingSlots && (
            <div className="resched__grid-slots">
              {Array.from({ length: 6 }).map((_, index) => (
                <span className="skeleton resched__skeleton" key={index} />
              ))}
            </div>
          )}

          {date && !loadingSlots && slots && slots.slots.length === 0 && (
            <div className="resched__hint">
              <Clock3 />
              <span>На этот день свободного времени нет — выберите другой.</span>
            </div>
          )}

          {date && !loadingSlots && slots && slots.slots.length > 0 && (
            <div className="resched__grid-slots">
              {slots.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.iso}
                  className="resched__slot"
                  data-selected={time === slot.time || undefined}
                  onClick={() => setTime(slot.time)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}

          <label className="field resched__comment">
            <span className="field__label">Причина переноса (необязательно)</span>
            <input
              className="input"
              value={comment}
              maxLength={200}
              placeholder="Например: клиент попросил другую дату"
              onChange={(event) => setComment(event.target.value)}
            />
          </label>

          {error && <div className="resched__error">{error}</div>}
        </div>
      </div>
    </Modal>
  );
}
