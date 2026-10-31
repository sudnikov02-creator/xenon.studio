import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Copy, Home, Link2 } from 'lucide-react';
import { formatLongDate, relativeDayLabel } from '../../lib/booking';
import { formatMoney } from '../../lib/utils';
import type { CreatedBooking } from '../../types';

export function BookingSuccess({
  created,
  today,
  currencySymbol,
  decimalSeparator,
  variant,
  onReset,
  onClose
}: {
  created: CreatedBooking;
  today: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  variant: 'public' | 'admin';
  onReset: () => void;
  onClose?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const booking = created.booking;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/b/${booking.code}` : `/b/${booking.code}`;

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [link]);

  return (
    <div className="bk-success">
      <span className="bk-success__icon" aria-hidden>
        <Check />
      </span>
      <h2>{variant === 'admin' ? 'Запись создана' : 'Заявка отправлена'}</h2>
      <p>
        {variant === 'admin'
          ? 'Клиент появился в CRM, а запись — в списке со статусом «Заявка».'
          : 'Фотограф получит уведомление и подтвердит время. Ссылка на страницу съёмки уже готова.'}
      </p>

      <div className="bk-success__card">
        <div className="bk-success__row">
          <span>
            <CalendarDays />
          </span>
          <div>
            <b>{booking.service?.name || booking.package?.name || 'Съёмка'}</b>
            <em>
              {relativeDayLabel(booking.localDate, today) ? `${relativeDayLabel(booking.localDate, today)}, ` : ''}
              {formatLongDate(booking.localDate)}
            </em>
          </div>
          <span className="bk-success__price tnum">
            {formatMoney(booking.price, currencySymbol, decimalSeparator)}
          </span>
        </div>

        <button type="button" className="bk-success__link" onClick={() => void copy()}>
          <span className="bk-success__code">
            <Link2 /> /b/{booking.code}
          </span>
          <span className="bk-success__copy">{copied ? <Check /> : <Copy />} {copied ? 'Скопировано' : 'Копировать'}</span>
        </button>
      </div>

      <div className="bk-success__actions">
        <button type="button" className="btn btn--primary" onClick={variant === 'admin' ? onReset : onReset}>
          {variant === 'admin' ? 'Добавить ещё запись' : 'Записать ещё одну съёмку'} <ArrowRight />
        </button>
        {variant === 'admin' && onClose ? (
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Закрыть
          </button>
        ) : (
          <Link to="/" className="btn btn--ghost">
            <Home /> На главную
          </Link>
        )}
      </div>
    </div>
  );
}
