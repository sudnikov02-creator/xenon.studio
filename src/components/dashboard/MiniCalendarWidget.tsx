import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayMonthLabel, formatMonthTitle, formatTimeIn, plural } from '../../lib/utils';
import type { CalendarData } from '../../types';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function MiniCalendarWidget({
  calendar,
  loading,
  timezone,
  onMonthChange
}: {
  calendar: CalendarData | null;
  loading: boolean;
  timezone: string;
  onMonthChange: (month: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!calendar) return null;
    const [year, month] = calendar.month.split('-').map(Number);
    const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= total; day += 1) {
      cells.push(`${calendar.month}-${String(day).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return { cells, total };
  }, [calendar]);

  const activeDay = useMemo(() => {
    if (!calendar) return null;
    const todayInMonth = calendar.today.startsWith(calendar.month);
    if (selected && selected.startsWith(calendar.month)) return selected;
    if (todayInMonth) return calendar.today;
    return `${calendar.month}-01`;
  }, [calendar, selected]);

  const dayItems = useMemo(() => {
    if (!calendar || !activeDay) return [];
    return calendar.items.filter((item) => item.localDate === activeDay);
  }, [calendar, activeDay]);

  if (!calendar || !model) {
    return (
      <div className="mini-cal mini-cal--loading" aria-busy="true">
        <span className="skeleton" style={{ height: 26, width: '55%' }} />
        <span className="skeleton" style={{ height: 190, marginTop: 14, borderRadius: 12 }} />
        <span className="skeleton" style={{ height: 52, marginTop: 12, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="mini-cal" data-loading={loading || undefined}>
      <div className="mini-cal__head">
        <div>
          <div className="mini-cal__month">{formatMonthTitle(calendar.month)}</div>
          <div className="mini-cal__sum">
            {calendar.items.length} {plural(calendar.items.length, 'съёмка', 'съёмки', 'съёмок')} в месяце
          </div>
        </div>
        <div className="mini-cal__nav">
          {calendar.month !== calendar.today.slice(0, 7) && (
            <button
              type="button"
              className="mini-cal__today"
              onClick={() => {
                setSelected(null);
                onMonthChange(calendar.today.slice(0, 7));
              }}
            >
              Сегодня
            </button>
          )}
          <button
            type="button"
            className="btn btn--icon btn--bordered mini-cal__nav-btn"
            aria-label="Предыдущий месяц"
            onClick={() => onMonthChange(shift(calendar.month, -1))}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--bordered mini-cal__nav-btn"
            aria-label="Следующий месяц"
            onClick={() => onMonthChange(shift(calendar.month, 1))}
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="mini-cal__weekdays">
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="mini-cal__grid">
        {model.cells.map((key, index) => {
          if (!key) return <span className="mini-cal__blank" key={`blank-${index}`} />;
          const info = calendar.days[key];
          const count = info?.count || 0;
          const pending = info?.pending || 0;
          const isToday = key === calendar.today;
          const isSelected = key === activeDay;
          const dayNumber = Number(key.slice(8, 10));
          return (
            <button
              type="button"
              key={key}
              className="mini-cal__day"
              data-today={isToday || undefined}
              data-selected={isSelected || undefined}
              data-busy={count > 0 || undefined}
              aria-label={`${dayNumber} ${formatMonthTitle(calendar.month)}${count ? `, ${count} съёмок` : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelected(key)}
            >
              <span>{dayNumber}</span>
              <span className="mini-cal__dots" aria-hidden>
                {pending > 0 && <i data-kind="pending" />}
                {count - pending > 0 && <i />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mini-cal__agenda">
        <div className="mini-cal__agenda-head">
          <b>{activeDay ? dayMonthLabel(activeDay) : '—'}</b>
          <span>
            {dayItems.length
              ? `${dayItems.length} ${plural(dayItems.length, 'съёмка', 'съёмки', 'съёмок')}`
              : 'свободно'}
          </span>
        </div>
        {dayItems.length === 0 ? (
          <p className="mini-cal__empty">Нет записей на этот день.</p>
        ) : (
          <div className="mini-cal__items">
            {dayItems.slice(0, 3).map((item) => (
              <div className="mini-cal__item" key={item.id}>
                <span className="mini-cal__item-time tnum">{formatTimeIn(item.startsAt, timezone)}</span>
                <span className="mini-cal__item-dot" style={{ background: item.statusColor }} aria-hidden />
                <span className="mini-cal__item-name">{item.clientName}</span>
                <span className="mini-cal__item-status">{item.statusName}</span>
              </div>
            ))}
            {dayItems.length > 3 && <span className="mini-cal__more">и ещё {dayItems.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function shift(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
