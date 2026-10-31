import { CalendarX2, ChevronLeft, ChevronRight, Clock3, Loader2 } from 'lucide-react';
import { formatMonthTitle, plural } from '../../lib/utils';
import { WEEKDAY_SHORT, dayNumber, formatLongDate, monthCells, relativeDayLabel, shiftMonth } from '../../lib/booking';
import type { AvailabilityResponse, BookingDraft, BookingFormOptions, SlotsResponse } from '../../types';

export function StepSchedule({
  options,
  draft,
  month,
  availability,
  slots,
  loadingMonth,
  loadingSlots,
  onMonthChange,
  onSelectDate,
  onSelectTime
}: {
  options: BookingFormOptions;
  draft: BookingDraft;
  month: string;
  availability: AvailabilityResponse | null;
  slots: SlotsResponse | null;
  loadingMonth: boolean;
  loadingSlots: boolean;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}) {
  const today = options.today;
  const cells = monthCells(month);
  const freeDays = availability?.days || {};
  const canGoPrev = month > options.month;
  const maxMonth = options.today.slice(0, 7);

  return (
    <div className="bk-step-inner">
      <header className="bk-step-head">
        <h2>Когда вам удобно?</h2>
        <p>
          Свободные дни подсвечены. Минимальный запас времени — {options.schedule.minNoticeHours} ч, запись открыта
          на {options.schedule.horizonDays} дней вперёд.
        </p>
      </header>

      <div className="bk-schedule">
        <div className="bk-cal">
          <div className="bk-cal__head">
            <div>
              <b>{formatMonthTitle(month)}</b>
              <span>
                {Object.keys(freeDays).length
                  ? `${Object.keys(freeDays).length} ${plural(Object.keys(freeDays).length, 'день', 'дня', 'дней')} со свободными слотами`
                  : 'нет свободных дней'}
              </span>
            </div>
            <div className="bk-cal__nav">
              <button
                type="button"
                className="btn btn--icon btn--bordered"
                onClick={() => onMonthChange(shiftMonth(month, -1))}
                disabled={month <= maxMonth}
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft />
              </button>
              <button
                type="button"
                className="btn btn--icon btn--bordered"
                onClick={() => onMonthChange(shiftMonth(month, 1))}
                aria-label="Следующий месяц"
              >
                <ChevronRight />
              </button>
            </div>
          </div>

          <div className="bk-cal__weekdays">
            {WEEKDAY_SHORT.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="bk-cal__grid" data-loading={loadingMonth || undefined}>
            {cells.map((key, index) => {
              if (!key) return <span className="bk-cal__blank" key={`blank-${index}`} />;
              const info = freeDays[key];
              const disabled = !info || key < today;
              const selected = draft.date === key;
              return (
                <button
                  type="button"
                  key={key}
                  className="bk-cal__cell"
                  data-today={key === today || undefined}
                  data-selected={selected || undefined}
                  data-free={Boolean(info) || undefined}
                  disabled={disabled}
                  onClick={() => onSelectDate(key)}
                  aria-label={`${dayNumber(key)} ${formatMonthTitle(month)}${info ? `, свободно ${info.count}` : ', нет мест'}`}
                  aria-pressed={selected}
                >
                  <span>{dayNumber(key)}</span>
                  {info && <i aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className="bk-cal__legend">
            <span>
              <i data-kind="free" /> есть места
            </span>
            <span>
              <i data-kind="today" /> сегодня
            </span>
          </div>
        </div>

        <div className="bk-slots">
          <div className="bk-slots__head">
            <div>
              <b>{draft.date ? formatLongDate(draft.date) : 'Выберите день'}</b>
              <span>
                {draft.date
                  ? relativeDayLabel(draft.date, today) || 'Свободное время'
                  : 'Время появится после выбора даты'}
              </span>
            </div>
            {slots && slots.slots.length > 0 && (
              <span className="bk-slots__count">
                {slots.slots.length} {plural(slots.slots.length, 'слот', 'слота', 'слотов')}
              </span>
            )}
          </div>

          {!draft.date && (
            <div className="bk-empty bk-empty--sm">
              <Clock3 />
              <p>Нажмите на подсвеченный день в календаре — покажем свободное время.</p>
            </div>
          )}

          {draft.date && loadingSlots && (
            <div className="bk-slots__grid" aria-busy="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <span className="skeleton bk-slot-skeleton" key={index} />
              ))}
            </div>
          )}

          {draft.date && !loadingSlots && slots && slots.slots.length === 0 && (
            <div className="bk-empty bk-empty--sm">
              <CalendarX2 />
              <b>На этот день всё занято</b>
              <p>Выберите другой день — ближайшие свободные даты подсвечены в календаре.</p>
            </div>
          )}

          {draft.date && !loadingSlots && slots && slots.slots.length > 0 && (
            <div className={loadingSlots ? 'bk-slots__grid is-loading' : 'bk-slots__grid'}>
              {slots.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.iso}
                  className="bk-slot"
                  data-selected={draft.time === slot.time || undefined}
                  onClick={() => onSelectTime(slot.time)}
                  aria-pressed={draft.time === slot.time}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}

          {loadingSlots && (
            <div className="bk-slots__loading">
              <Loader2 /> Проверяем свободное время
            </div>
          )}
        </div>
      </div>

      {!options.schedule.accepting && (
        <div className="bk-note bk-note--warning">
          Фотограф временно закрыл онлайн-запись — заявка сохранится и он свяжется с вами.
        </div>
      )}
    </div>
  );
}
