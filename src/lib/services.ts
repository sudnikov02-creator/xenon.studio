import type { Service, ServiceAddon, ServicePackage } from '../types';

export const DURATION_OPTIONS = [30, 40, 45, 60, 90, 120, 150, 180, 240];
export const BUFFER_OPTIONS = [0, 15, 30, 45, 60];

export const ADDON_TYPE_LABELS: Record<ServiceAddon['type'], string> = {
  toggle: 'Фиксированная',
  quantity: 'За количество'
};

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} мин`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total % 60 === 0) return `${total / 60} ч`;
  return formatDuration(total);
}

export function makeAddon(index = 0): ServiceAddon {
  return {
    id: `addon-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    type: 'toggle',
    price: 0
  };
}

export function addonSummary(addon: ServiceAddon, currency: string): string {
  if (addon.type === 'quantity') {
    return `${formatPrice(addon.price, currency)} / ${addon.unit || 'шт'}`;
  }
  return formatPrice(addon.price, currency);
}

export function formatPrice(value: number, currency = '₽'): string {
  return `${Math.round(value).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} ${currency}`;
}

export function packageServices(item: ServicePackage, services: Service[]): Service[] {
  const map = new Map(services.map((service) => [service.id, service]));
  return item.serviceIds.map((id) => map.get(id)).filter((service): service is Service => Boolean(service));
}

export function packageTotals(item: ServicePackage, services: Service[]) {
  const included = packageServices(item, services);
  const sum = included.reduce((total, service) => total + service.price, 0);
  const duration = included.reduce((total, service) => total + service.duration, 0);
  const saving = Math.max(0, sum - item.price);
  const percent = sum > 0 ? Math.round((saving / sum) * 100) : 0;
  return { included, sum, duration, saving, percent };
}

export function serviceDraftDefaults(): Omit<Service, 'id' | 'sortOrder' | 'bookings'> {
  return {
    name: '',
    description: '',
    price: 0,
    duration: 60,
    buffer: 15,
    addons: [],
    isActive: true
  };
}

export function normalizeDraftAddons(addons: ServiceAddon[]): ServiceAddon[] {
  return addons
    .filter((addon) => addon.name.trim().length > 0)
    .map((addon) => ({
      ...addon,
      name: addon.name.trim(),
      price: Math.max(0, Math.round(Number(addon.price) || 0)),
      ...(addon.type === 'quantity' ? { unit: (addon.unit || 'шт').trim() || 'шт' } : {})
    }));
}

export function bookingsLabel(count: number): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${count} записей`;
  if (last === 1) return `${count} запись`;
  if (last > 1 && last < 5) return `${count} записи`;
  return `${count} записей`;
}
