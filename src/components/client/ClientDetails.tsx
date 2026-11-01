import { CalendarClock, Camera, Image, Layers, MessageSquareQuote, Receipt, Sparkles } from 'lucide-react';
import { formatDayLabel, formatMoney } from '../../lib/utils';
import { formatDuration } from '../../lib/services';
import type { ClientBookingView } from '../../types';

export function ClientDetails({ view }: { view: ClientBookingView }) {
  const { booking, service, package: pkg, studio } = view;
  const addons = booking.addons || [];
  const addonsTotal = addons.reduce((sum, addon) => sum + (addon.price || 0) * (addon.qty || 1), 0);
  const total = booking.price + addonsTotal;

  return (
    <div className="cp-cards">
      <article className="cp-card">
        <header className="cp-card__head">
          <span className="cp-card__icon">
            <Camera />
          </span>
          <div>
            <h3>{pkg?.name || service?.name || 'Съёмка'}</h3>
            <p className="cp-card__sub">
              {formatDayLabel(booking.startsAt, studio.timezone)} · {booking.localTime} ·{' '}
              {formatDuration(booking.duration)}
            </p>
          </div>
        </header>

        {pkg ? (
          <ul className="cp-chips">
            {pkg.services.map((item) => (
              <li key={item.name}>
                <Layers /> {item.name}
              </li>
            ))}
          </ul>
        ) : (
          service?.description && <p className="cp-card__text">{service.description}</p>
        )}

        <div className="cp-note">
          <CalendarClock />
          <span>
            Приходите за 5–10 минут — будет время спокойно освоиться и обсудить идеи. Если опаздываете,
            просто позвоните.
          </span>
        </div>
      </article>

      <article className="cp-card">
        <header className="cp-card__head">
          <span className="cp-card__icon">
            <Receipt />
          </span>
          <div>
            <h3>Стоимость</h3>
            <p className="cp-card__sub">Оплата в день съёмки</p>
          </div>
        </header>

        <ul className="cp-price">
          <li>
            <span>{pkg?.name || service?.name || 'Съёмка'}</span>
            <b className="tnum">{formatMoney(booking.price, studio.currencySymbol, studio.decimalSeparator)}</b>
          </li>
          {addons.map((addon) => (
            <li key={addon.id}>
              <span>
                {addon.name}
                {addon.qty && addon.qty > 1 ? ` × ${addon.qty}` : ''}
              </span>
              <b className="tnum">
                {formatMoney((addon.price || 0) * (addon.qty || 1), studio.currencySymbol, studio.decimalSeparator)}
              </b>
            </li>
          ))}
          <li className="cp-price__total">
            <span>Итого</span>
            <b className="tnum">{formatMoney(total, studio.currencySymbol, studio.decimalSeparator)}</b>
          </li>
        </ul>
      </article>

      {booking.clientNote && (
        <article className="cp-card cp-card--quote">
          <header className="cp-card__head">
            <span className="cp-card__icon">
              <MessageSquareQuote />
            </span>
            <div>
              <h3>Ваше пожелание</h3>
              <p className="cp-card__sub">Фотограф увидит это до съёмки</p>
            </div>
          </header>
          <p className="cp-card__text">{booking.clientNote}</p>
        </article>
      )}

      {booking.galleryUrl && (
        <a className="cp-card cp-card--link" href={booking.galleryUrl} target="_blank" rel="noreferrer">
          <header className="cp-card__head">
            <span className="cp-card__icon">
              <Image />
            </span>
            <div>
              <h3>Галерея готова</h3>
              <p className="cp-card__sub">Открыть обработанные кадры</p>
            </div>
          </header>
          <span className="cp-card__cta">
            Перейти в галерею <Sparkles />
          </span>
        </a>
      )}

      {!booking.galleryUrl && !view.status?.isFinal && !view.status?.isCancelled && (
        <div className="cp-hint">
          <Image />
          <span>
            Готовые кадры приходят ссылкой на галерею — обычно в течение 14 дней после съёмки. Ссылка
            появится на этой странице.
          </span>
        </div>
      )}
    </div>
  );
}
