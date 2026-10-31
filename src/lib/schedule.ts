import type { Schedule, ScheduleDay, ScheduleException } from '../types';

export const WEEKDAYS = [
  { day: 1, short: 'Пн', full: 'Понедельник' },
  { day: 2, short: 'Вт', full: 'Вторник' },
  { day: 3, short: 'Ср', full: 'Среда' },
  { day: 4, short: 'Чт', full: 'Четверг' },
  { day: 5, short: 'Пт', full: 'Пятница' },
  { day: 6, short: 'Сб', full: 'Суббота' },
  { day: 7, short: 'Вс', full: 'Воскресенье' }
];

export const DEFAULT_SCHEDULE: Schedule = {
  accepting: true,
  week: [
    { day: 1, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
    { day: 2, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
    { day: 3, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
    { day: 4, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
    { day: 5, enabled: true, start: '10:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    { day: 6, enabled: true, start: '11:00', end: '16:00', breakStart: null, breakEnd: null },
    { day: 7, enabled: false, start: '11:00', end: '16:00', breakStart: null, breakEnd: null }
  ],
  bufferMin: 15,
  minNoticeHours: 12,
  horizonDays: 90,
  exceptions: []
};

export const NOTICE_OPTIONS = [0, 2, 4, 8, 12, 24, 48, 72];
export const HORIZON_OPTIONS = [14, 30, 60, 90, 120, 180, 365];
export const BUFFER_OPTIONS_MIN = [0, 15, 30, 45, 60];

export function minutesOf(time: string | null | undefined): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function formatHours(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function dayMinutes(day: ScheduleDay): number {
  if (!day.enabled) return 0;
  const total = minutesOf(day.end) - minutesOf(day.start);
  const pause = day.breakStart && day.breakEnd ? minutesOf(day.breakEnd) - minutesOf(day.breakStart) : 0;
  return Math.max(0, total - Math.max(0, pause));
}

export function weekMinutes(schedule: Schedule): number {
  return schedule.week.reduce((sum, day) => sum + dayMinutes(day), 0);
}

export function enabledDays(schedule: Schedule): number {
  return schedule.week.filter((day) => day.enabled).length;
}

export function weekdayLabel(day: number): string {
  return WEEKDAYS.find((item) => item.day === day)?.full || '';
}

export function normalizeScheduleClient(input: Schedule | null | undefined): Schedule {
  const source = input && typeof input === 'object' ? input : DEFAULT_SCHEDULE;
  return {
    accepting: source.accepting !== false,
    week: DEFAULT_SCHEDULE.week.map((fallback) => {
      const found = Array.isArray(source.week) ? source.week.find((day) => Number(day?.day) === fallback.day) : null;
      return found
        ? {
            day: fallback.day,
            enabled: Boolean(found.enabled),
            start: found.start || fallback.start,
            end: found.end || fallback.end,
            breakStart: found.breakStart || null,
            breakEnd: found.breakEnd || null
          }
        : { ...fallback };
    }),
    bufferMin: Number.isFinite(Number(source.bufferMin)) ? Number(source.bufferMin) : 15,
    minNoticeHours: Number.isFinite(Number(source.minNoticeHours)) ? Number(source.minNoticeHours) : 12,
    horizonDays: Number.isFinite(Number(source.horizonDays)) ? Number(source.horizonDays) : 90,
    exceptions: (Array.isArray(source.exceptions) ? source.exceptions : [])
      .filter((item): item is ScheduleException => Boolean(item) && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)))
      .map((item) => ({
        date: item.date,
        closed: Boolean(item.closed),
        start: item.closed ? null : item.start || null,
        end: item.closed ? null : item.end || null,
        note: item.note || null
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}

export function schedulesEqual(a: Schedule, b: Schedule): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function exceptionTitle(item: ScheduleException): string {
  const date = new Date(`${item.date}T12:00:00`);
  const formatted = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
    timeZone: 'Europe/Minsk'
  }).format(date);
  return formatted;
}

export function nextExceptionDays(exceptions: ScheduleException[], count = 2): ScheduleException[] {
  const today = new Date().toISOString().slice(0, 10);
  return exceptions
    .filter((item) => item.date >= today)
    .slice(0, count);
}
