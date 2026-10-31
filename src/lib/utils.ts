export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

export function pluralize(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`;
}

const RU = 'ru-RU';

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(RU, { timeZone: 'Europe/Minsk', ...opts }).format(date);
}

export function formatTime(iso: string | Date): string {
  return formatDate(iso, { hour: '2-digit', minute: '2-digit' });
}

export function formatWeekday(iso: string | Date): string {
  return formatDate(iso, { weekday: 'short' });
}

export function relativeTime(iso: string): string {
  const date = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} ${plural(min, 'минуту', 'минуты', 'минут')} назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ${plural(hours, 'час', 'часа', 'часов')} назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  return formatDate(iso, { day: 'numeric', month: 'short' });
}

export function formatMoney(amount: number, symbol = '₽', separator: 'comma' | 'dot' = 'comma'): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const grouped = Math.abs(rounded)
    .toFixed(Number.isInteger(rounded) ? 0 : 2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const sign = rounded < 0 ? '−' : '';
  const formatted = separator === 'comma' ? grouped.replace('.', ',') : grouped;
  return `${sign}${formatted}\u00a0${symbol}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function zonedDayKey(value: string | Date, timeZone = 'Europe/Minsk'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatTimeIn(value: string | Date, timeZone = 'Europe/Minsk'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDayLabel(value: string | Date, timeZone = 'Europe/Minsk'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const key = zonedDayKey(date, timeZone);
  const today = zonedDayKey(new Date(), timeZone);
  const tomorrow = zonedDayKey(new Date(Date.now() + 86400000), timeZone);
  if (key === today) return 'сегодня';
  if (key === tomorrow) return 'завтра';
  return new Intl.DateTimeFormat('ru-RU', { timeZone, day: 'numeric', month: 'long' }).format(date);
}

export function formatDayTime(value: string | Date, timeZone = 'Europe/Minsk'): string {
  const label = formatDayLabel(value, timeZone);
  return `${label.charAt(0).toUpperCase() + label.slice(1)}, ${formatTimeIn(value, timeZone)}`;
}

export function formatMonthTitle(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, 1))
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonthKey(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dayMonthLabel(dayKey: string): string {
  const [year, m, d] = dayKey.split('-').map(Number);
  const label = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, m - 1, d))
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}
