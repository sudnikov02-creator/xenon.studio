import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import {
  dayMonthLabel,
  formatMonthTitle,
  formatTimeIn,
  pluralize,
  shiftMonthKey,
  zonedDayKey
} from '../../lib/utils';
import type { CalendarData } from '../../types';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function monthGrid(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= total; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MiniCalendarWidget({
  calendar,
  loading,
  onLoadMonth
}: {
  calendar: CalendarData | null;
  loading: boolean;
  onLoadMonth: (month: string) => void;
}) {
  const { branding } = useSettings();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!calendar) return;
    const todayKey = zonedDayKey(new Date(), branding.timezone);
    const currentMonth = todayKey.slice(0, 7);
    if (calendar.month === currentMonth) {
      setSelected(todayKey);
      return;
    }
    const firstWithBooking = calendar.items[0]?.localDate;
    setSelected(firstWithBooking || `${calendar.month}-01`);
  }, [calendar, branding.timezone]);

  const cells = useMemo(() => (calendar ? monthGrid(calendar.month) : []), [calendar]);
  const items = useMemo(
    () => (calendar && selected ? calendar.items.filter((item) => item.localDate === selected) : []),
    [calendar, selected]
  );

  if (!calendar) {
    return <div className="minical minical--loading" aria-busy="true" />;
  }

  const todayKey = zonedDayKey(new Date(), branding.timezone);

  return (
    <div className="minical" data-loading={loading || undefined}>
      <div className="minical__head">
        <div>
          <div className="minical__month">{formatMonthTitle(calendar.month)}</div>
          <div className="minical__sub">
            {pluralize(
              Object.values(calendar.days).reduce((sum, day) => sum + day.count, 0),
              'съёмка',
              'съёмки',
              'съёмок'
            )}{' '}
            в месяце
          </div>
        </div>
        <div className="minical__nav">
          <button
            type="button"
            className="btn btn--icon btn--bordered minical__nav-btn"
            onClick={() => onLoadMonth(shiftMonthKey(calendar.month, -1))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="btn btn--icon btn--bordered minical__nav-btn"
            onClick={() => onLoadMonth(shiftMonthKey(calendar.month, 1))}
            aria-label="Следующий месяц"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="minical__weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="minical__grid">
        {cells.map((day, index) => {
          if (day === null) return <span className="minical__blank" key={`blank-${index}`} />;
          const key = `${calendar.month}-${String(day).padStart(2, '0')}`;
          const info = calendar.days[key];
          const isSelected = selected === key;
          const isToday = key === todayKey;
          const dots = info ? Array.from({ length: Math.min(3, info.count) }) : [];
          return (
            <button
              type="button"
              key={key}
              className="minical__day"
              data-today={isToday || undefined}
              data-selected={isSelected || undefined}
              data-busy={Boolean(info?.count) || undefined}
              onClick={() => setSelected(key)}
              aria-pressed={isSelected}
              aria-label={`${dayMonthLabel(key)}${info ? `, ${info.count} съёмок` : ''}`}
            >
              <span className="tnum">{day}</span>
              {dots.length > 0 && (
                <span className="minical__dots">
                  {dots.map((_, dotIndex) => (
                    <span
                      key={dotIndex}
                      className="minical__dot"
                      data-pending={dotIndex === 0 && info!.pending > 0 ? true : undefined}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="minical__agenda">
        <div className="minical__agenda-head">
          <b>{selected ? dayMonthLabel(selected) : 'Выберите день'}</b>
          <span>
            {items.length ? pluralize(items.length, 'съёмка', 'съёмки', 'съёмок') : 'свободно'}
          </span>
        </div>
        {items.slice(0, 3).map((item) => (
          <div className="minical__agenda-row" key={item.id}>
            <span className="minical__time tnum">{formatTimeIn(item.startsAt, branding.timezone)}</span>
            <span className="minical__status-dot" style={{ background: item.statusColor }} />
            <span className="truncate" style={{ flex: 1 }}>
              {item.clientName}
            </span>
            <span className="minical__status-name">{item.statusName}</span>
          </div>
        ))}
        {items.length > 3 && <div className="minical__more">и ещё {items.length - 3}</div>}
        {items.length === 0 && <div className="minical__free">Съёмок нет — день свободен</div>}
      </div>
    </div>
  );
}
