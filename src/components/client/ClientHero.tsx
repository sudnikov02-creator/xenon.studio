import { Camera, Clock3, Sparkles, Wallet } from 'lucide-react';
import { BookingStatusPill } from '../bookings/BookingStatusPill';
import { formatDuration } from '../../lib/services';
import { formatMoney, plural } from '../../lib/utils';
import type { ClientBookingView } from '../../types';

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря'
];

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function countdownLabel(view: ClientBookingView): string {
  const { status, permissions, booking } = view;
  if (status?.isCancelled) return 'Запись отменена';
  if (status?.isFinal) return 'Съёмка завершена';
  const start = new Date(booking.startsAt).getTime();
  const diff = start - Date.now();
  if (diff <= 0) return 'Съёмка прошла';
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `До съёмки ${Math.max(1, Math.round(diff / 60000))} мин`;
  if (hours < 24) return `До съёмки ${hours} ч`;
  const days = Math.round(diff / 86400000);
  if (days === 1) return 'Съёмка завтра';
  return `До съёмки ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

export function ClientHero({ view }: { view: ClientBookingView }) {
  const { booking, status, service, package: pkg, studio } = view;
  const [year, month, day] = booking.localDate.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const itemName = pkg?.name || service?.name || 'Съёмка';

  return (
    <section className="cp-hero" style={{ '--status': status?.color || 'var(--accent)' } as React.CSSProperties}>
      <span className="cp-hero__glow" aria-hidden />

      <header className="cp-hero__top">
        <span className="cp-hero__eyebrow">
          <Sparkles /> Ваша съёмка
        </span>
        <BookingStatusPill status={status} />
      </header>

      <div className="cp-hero__date">
        <b className="tnum">{day}</b>
        <span>
          <em>{weekday}</em>
          <strong>
            {MONTHS_GENITIVE[month - 1]} {year}
          </strong>
        </span>
      </div>

      <div className="cp-hero__facts">
        <span>
          <Clock3 /> {booking.localTime} · {formatDuration(booking.duration)}
        </span>
        <span>
          <Camera /> {itemName}
        </span>
        <span>
          <Wallet /> {formatMoney(booking.price, studio.currencySymbol, studio.decimalSeparator)}
        </span>
      </div>

      <div className="cp-hero__countdown" data-done={status?.isFinal || status?.isCancelled || undefined}>
        <i aria-hidden />
        {countdownLabel(view)}
      </div>
    </section>
  );
}
