import type {
  BookingDraft,
  BookingFormOptions,
  Service,
  ServiceAddon,
  ServicePackage
} from '../types';

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const STEP_TITLES = ['Услуга', 'Время', 'Детали', 'Контакты', 'Подтверждение'];

export const EMPTY_DRAFT: BookingDraft = {
  serviceId: null,
  packageId: null,
  date: '',
  time: '',
  addons: {},
  name: '',
  phone: '',
  email: '',
  instagram: '',
  note: '',
  agreed: false
};

/* ------------------------------- телефон ------------------------------- */

export function phoneDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Маска прогрессивного ввода: +375 29 123-45-67, +7 999 123-45-67, иначе +digits. */
export function maskPhone(value: string): string {
  let digits = phoneDigits(value);
  if (!digits) return '';
  if (digits.startsWith('80') && digits.length > 10) digits = `375${digits.slice(2)}`;
  if (digits.startsWith('0') && digits.length > 10) digits = digits.replace(/^0+/, '');

  if (digits.startsWith('375')) {
    const rest = digits.slice(3, 12);
    let out = '+375';
    if (rest.length) out += ` ${rest.slice(0, 2)}`;
    if (rest.length > 2) out += ` ${rest.slice(2, 5)}`;
    if (rest.length > 5) out += `-${rest.slice(5, 7)}`;
    if (rest.length > 7) out += `-${rest.slice(7, 9)}`;
    return out;
  }
  if (digits.startsWith('7') && digits.length <= 11) {
    const rest = digits.slice(1, 11);
    let out = '+7';
    if (rest.length) out += ` ${rest.slice(0, 3)}`;
    if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
    if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
    if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
    return out;
  }
  return `+${digits.slice(0, 15)}`;
}

export function isValidPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[a-zA-Zа-яА-Я]{2,}$/.test(value.trim());
}

/* ------------------------------- даты ------------------------------- */

export function monthOf(dateKey: string): string {
  return (dateKey || '').slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function relativeDayLabel(dateKey: string, today: string): string {
  if (!dateKey) return '';
  if (dateKey === today) return 'Сегодня';
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const [ty, tm, td] = today.split('-').map(Number);
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));
  const diff = Math.round((date.getTime() - todayDate.getTime()) / 86400000);
  if (diff === 1) return 'Завтра';
  if (diff === 2) return 'Послезавтра';
  return '';
}

export function formatLongDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const text = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ------------------------------- услуги ------------------------------- */

export function packageDuration(item: ServicePackage, services: Service[]): number {
  const map = new Map(services.map((service) => [service.id, service]));
  const total = item.serviceIds.reduce((sum, id) => sum + (map.get(id)?.duration || 0), 0);
  return total || 90;
}

export function selectedItem(
  options: BookingFormOptions | null,
  draft: BookingDraft
): { kind: 'service' | 'package'; id: number; name: string; price: number; duration: number; addons: ServiceAddon[] } | null {
  if (!options) return null;
  if (draft.serviceId) {
    const service = options.services.find((item) => item.id === draft.serviceId);
    if (!service) return null;
    return {
      kind: 'service',
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.duration,
      addons: service.addons || []
    };
  }
  if (draft.packageId) {
    const item = options.packages.find((entry) => entry.id === draft.packageId);
    if (!item) return null;
    return {
      kind: 'package',
      id: item.id,
      name: item.name,
      price: item.price,
      duration: packageDuration(item, options.services),
      addons: item.addons || []
    };
  }
  return null;
}

export function addonPrice(addon: ServiceAddon, qty: number): number {
  if (addon.type === 'quantity') return addon.price * Math.max(0, qty);
  return qty > 0 ? addon.price : 0;
}

export function addonLines(addons: ServiceAddon[], selection: Record<string, number>) {
  return addons
    .map((addon) => {
      const qty = Math.max(0, selection[addon.id] || 0);
      return { addon, qty, total: addonPrice(addon, qty) };
    })
    .filter((line) => line.qty > 0);
}

export function draftTotal(
  item: { price: number; addons: ServiceAddon[] } | null,
  draft: BookingDraft
): { base: number; extras: number; total: number; lines: { addon: ServiceAddon; qty: number; total: number }[] } {
  if (!item) return { base: 0, extras: 0, total: 0, lines: [] };
  const lines = addonLines(item.addons, draft.addons);
  const extras = lines.reduce((sum, line) => sum + line.total, 0);
  return { base: item.price, extras, total: item.price + extras, lines };
}

export function buildAddonsPayload(draft: BookingDraft) {
  return Object.entries(draft.addons)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty }));
}

export function isStepValid(step: number, draft: BookingDraft, options: BookingFormOptions | null): boolean {
  switch (step) {
    case 0:
      return Boolean(draft.serviceId || draft.packageId);
    case 1:
      return Boolean(draft.date && draft.time);
    case 2:
      return true;
    case 3:
      return (
        draft.name.trim().length >= 2 &&
        isValidPhone(draft.phone) &&
        isValidEmail(draft.email) &&
        (!options?.form.askInstagram || true) &&
        (!options?.agreement.enabled || draft.agreed)
      );
    default:
      return true;
  }
}

export function contactErrors(draft: BookingDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 2) errors.name = 'Как к вам обращаться?';
  if (!isValidPhone(draft.phone)) errors.phone = 'Введите номер телефона полностью';
  if (!isValidEmail(draft.email)) errors.email = 'Проверьте адрес почты';
  return errors;
}
