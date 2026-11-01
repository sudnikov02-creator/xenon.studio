import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api, ApiError } from '../../lib/api';
import { formatMonthTitle, plural } from '../../lib/utils';
import { WEEKDAY_SHORT, dayNumber, formatLongDate, monthCells, shiftMonth } from '../../lib/booking';
import type { ClientBookingView, ClientMonthPayload, ClientSlotsPayload } from '../../types';

export function ClientRescheduleModal({
  view,
  open,
  onClose,
  onDone
}: {
  view: ClientBookingView;
  open: boolean;
  onClose: () => void;
  onDone: (next: ClientBookingView) => void;
}) {
  const code = view.code;
  const [month, setMonth] = useState('');
  const [days, setDays] = useState<Record<string, { count: number; first: string; last: string }>>({});
  const [today, setToday] = useState(view.today);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<ClientSlotsPayload | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMonth = useCallback(
    async (target: string) => {
      setLoadingMonth(true);
      try {
        let data = await api.get<ClientMonthPayload>(`/public/bookings/${code}/availability?month=${target}`);
        if (Object.keys(data.days).length === 0) {
          data = await api.get<ClientMonthPayload>(
            `/public/bookings/${code}/availability?month=${shiftMonth(target, 1)}`
          );
        }
        setDays(data.days);
        setToday(data.today);
        setMonth(data.month);
      } catch {
        setDays({});
        setMonth(target);
      } finally {
        setLoadingMonth(false);
      }
    },
    [code]
  );

  useEffect(() => {
    if (!open) return;
    setDate('');
    setTime('');
    setSlots(null);
    setError(null);
    void loadMonth(new Date().toISOString().slice(0, 7));
  }, [open, loadMonth]);

  useEffect(() => {
    if (!open || !date) return;
    let alive = true;
    setLoadingSlots(true);
    setTime('');
    api
      .get<ClientSlotsPayload>(`/public/bookings/${code}/slots?date=${date}`)
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
  }, [open, date, code]);

  const cells = useMemo(() => (month ? monthCells(month) : []), [month]);

  const submit = async () => {
    if (!date || !time) return;
    setSaving(true);
    setError(null);
    try {
      const next = await api.post<ClientBookingView>(`/public/bookings/${code}/reschedule`, { date, time });
      onDone(next);
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
      title="Перенести съёмку"
      subtitle={`Сейчас: ${formatLongDate(view.booking.localDate)} в ${view.booking.localTime}`}
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
            {time ? `Перенести на ${time}` : 'Выберите время'}
          </button>
        </>
      }
    >
      <div className="cr">
        <div className="cr__cal">
          <div className="cr__cal-head">
            <b>{formatMonthTitle(month || today.slice(0, 7))}</b>
            <div className="cr__nav">
              <button
                type="button"
                className="btn btn--icon btn--bordered"
                aria-label="Предыдущий месяц"
                disabled={!month || month <= today.slice(0, 7)}
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

          <div className="cr__weekdays">
            {WEEKDAY_SHORT.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="cr__grid" data-loading={loadingMonth || undefined}>
            {cells.map((key, index) => {
              if (!key) return <span className="cr__blank" key={`blank-${index}`} />;
              const info = days[key];
              return (
                <button
                  type="button"
                  key={key}
                  className="cr__cell"
                  data-free={Boolean(info) || undefined}
                  data-today={key === today || undefined}
                  data-selected={key === date || undefined}
                  disabled={!info}
                  aria-pressed={key === date}
                  aria-label={formatLongDate(key)}
                  onClick={() => setDate(key)}
                >
                  {dayNumber(key)}
                  {info && <i aria-hidden />}
                </button>
              );
            })}
          </div>

          <p className="cr__legend">
            <i aria-hidden /> дни со свободным временем · перенос не позднее чем за{' '}
            {view.schedule.minNoticeHours} ч
          </p>
        </div>

        <div className="cr__slots">
          <div className="cr__slots-head">
            <b>{date ? formatLongDate(date) : 'Выберите день'}</b>
            <span>
              {slots && slots.slots.length > 0
                ? `${slots.slots.length} ${plural(slots.slots.length, 'вариант', 'варианта', 'вариантов')}`
                : 'свободное время'}
            </span>
          </div>

          {!date && (
            <div className="cr__hint">
              <Clock3 />
              <span>Нажмите на подсвеченный день — покажем свободные часы.</span>
            </div>
          )}

          {date && loadingSlots && (
            <div className="cr__grid-slots">
              {Array.from({ length: 6 }).map((_, index) => (
                <span className="skeleton cr__skeleton" key={index} />
              ))}
            </div>
          )}

          {date && !loadingSlots && slots && slots.slots.length === 0 && (
            <div className="cr__hint">
              <Clock3 />
              <span>На этот день всё занято — выберите другой.</span>
            </div>
          )}

          {date && !loadingSlots && slots && slots.slots.length > 0 && (
            <div className="cr__grid-slots">
              {slots.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.iso}
                  className="cr__slot"
                  data-selected={time === slot.time || undefined}
                  onClick={() => setTime(slot.time)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}

          {error && <div className="cr__error">{error}</div>}
        </div>
      </div>
    </Modal>
  );
}
