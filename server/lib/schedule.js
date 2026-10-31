const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** ISO-ish weekday numbers: 1 = Monday … 7 = Sunday. */
export const DEFAULT_WEEK = [
  { day: 1, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  { day: 2, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  { day: 3, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  { day: 4, enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  { day: 5, enabled: true, start: '10:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  { day: 6, enabled: true, start: '11:00', end: '16:00', breakStart: null, breakEnd: null },
  { day: 7, enabled: false, start: '11:00', end: '16:00', breakStart: null, breakEnd: null }
];

export const DEFAULT_SCHEDULE = {
  accepting: true,
  week: DEFAULT_WEEK,
  bufferMin: 15,
  minNoticeHours: 12,
  horizonDays: 90,
  exceptions: []
};

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function minutesOf(time) {
  const [hours, minutes] = String(time || '0:0').split(':').map(Number);
  return hours * 60 + minutes;
}

export function normalizeWeek(input) {
  return DEFAULT_WEEK.map((fallback) => {
    const source = Array.isArray(input) ? input.find((day) => Number(day?.day) === fallback.day) : null;
    if (!source) return { ...fallback };
    const start = isValidTime(source.start) ? source.start : fallback.start;
    const end = isValidTime(source.end) ? source.end : fallback.end;
    const breaks = isValidTime(source.breakStart) && isValidTime(source.breakEnd) ? source : null;
    return {
      day: fallback.day,
      enabled: Boolean(source.enabled),
      start: minutesOf(start) < minutesOf(end) ? start : fallback.start,
      end: minutesOf(start) < minutesOf(end) ? end : fallback.end,
      breakStart: breaks ? source.breakStart : null,
      breakEnd: breaks ? source.breakEnd : null
    };
  });
}

export function normalizeExceptions(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')))
    .filter((item) => {
      if (seen.has(item.date)) return false;
      seen.add(item.date);
      return true;
    })
    .slice(0, 60)
    .map((item) => {
      const closed = Boolean(item.closed);
      const start = isValidTime(item.start) ? item.start : null;
      const end = isValidTime(item.end) ? item.end : null;
      const custom = !closed && start && end && minutesOf(start) < minutesOf(end);
      return {
        date: item.date,
        closed,
        start: custom ? start : null,
        end: custom ? end : null,
        note: String(item.note || '').trim().slice(0, 80) || null
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeSchedule(input, previous = DEFAULT_SCHEDULE) {
  const source = input && typeof input === 'object' ? input : {};
  const base = previous && typeof previous === 'object' ? previous : DEFAULT_SCHEDULE;
  const bufferMin = Number(source.bufferMin ?? base.bufferMin);
  const minNoticeHours = Number(source.minNoticeHours ?? base.minNoticeHours);
  const horizonDays = Number(source.horizonDays ?? base.horizonDays);

  return {
    accepting: source.accepting === undefined ? Boolean(base.accepting) : Boolean(source.accepting),
    week: normalizeWeek(source.week ?? base.week),
    bufferMin: Number.isFinite(bufferMin) ? Math.min(120, Math.max(0, Math.round(bufferMin))) : 15,
    minNoticeHours: Number.isFinite(minNoticeHours) ? Math.min(720, Math.max(0, Math.round(minNoticeHours))) : 12,
    horizonDays: Number.isFinite(horizonDays) ? Math.min(730, Math.max(1, Math.round(horizonDays))) : 90,
    exceptions: normalizeExceptions(source.exceptions ?? base.exceptions)
  };
}

export function weekHours(schedule) {
  return (schedule?.week || []).reduce((sum, day) => {
    if (!day.enabled) return sum;
    const total = minutesOf(day.end) - minutesOf(day.start);
    const pause =
      day.breakStart && day.breakEnd ? Math.max(0, minutesOf(day.breakEnd) - minutesOf(day.breakStart)) : 0;
    return sum + Math.max(0, total - pause);
  }, 0);
}
