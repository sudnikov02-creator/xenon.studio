import { Check, Clock3, Layers, Package } from 'lucide-react';
import { formatDuration, formatPrice, packageTotals } from '../../lib/services';
import { packageDuration } from '../../lib/booking';
import type { BookingDraft, BookingFormOptions } from '../../types';

export function StepService({
  options,
  draft,
  onSelect
}: {
  options: BookingFormOptions;
  draft: BookingDraft;
  onSelect: (patch: Partial<BookingDraft>) => void;
}) {
  const currency = options.branding.currencySymbol;

  return (
    <div className="bk-step-inner">
      <header className="bk-step-head">
        <h2>Что будем снимать?</h2>
        <p>
          {options.form.introText ||
            'Выберите услугу или готовый пакет — стоимость и длительность сразу видны.'}
        </p>
      </header>

      <div className="bk-service-list">
        {options.services.map((service) => {
          const active = draft.serviceId === service.id;
          return (
            <button
              type="button"
              key={`service-${service.id}`}
              className="bk-service"
              data-selected={active || undefined}
              data-kind="service"
              onClick={() =>
                onSelect({ serviceId: service.id, packageId: null, addons: {}, date: '', time: '' })
              }
              aria-pressed={active}
            >
              <span className="bk-service__mark">
                {active ? <Check /> : <Layers />}
              </span>
              <span className="bk-service__text">
                <b>{service.name}</b>
                <span className="bk-service__desc">{service.description}</span>
                <span className="bk-service__meta">
                  <span>
                    <Clock3 /> {formatDuration(service.duration)}
                  </span>
                  {service.addons.length > 0 && (
                    <span className="bk-service__badge">{service.addons.length} доп.</span>
                  )}
                </span>
              </span>
              <span className="bk-service__price tnum">{formatPrice(service.price, currency)}</span>
            </button>
          );
        })}

        {options.packages.map((item) => {
          const active = draft.packageId === item.id;
          const totals = packageTotals(item, options.services);
          return (
            <button
              type="button"
              key={`package-${item.id}`}
              className="bk-service bk-service--package"
              data-selected={active || undefined}
              data-kind="package"
              onClick={() =>
                onSelect({ packageId: item.id, serviceId: null, addons: {}, date: '', time: '' })
              }
              aria-pressed={active}
            >
              <span className="bk-service__mark">{active ? <Check /> : <Package />}</span>
              <span className="bk-service__text">
                <b>
                  {item.name}
                  <span className="bk-service__tag">Пакет</span>
                </b>
                <span className="bk-service__desc">{item.description}</span>
                <span className="bk-service__meta">
                  <span>
                    <Clock3 /> {formatDuration(packageDuration(item, options.services))}
                  </span>
                  {totals.saving > 0 && (
                    <span className="bk-service__badge bk-service__badge--save">выгода {totals.percent}%</span>
                  )}
                </span>
              </span>
              <span className="bk-service__price tnum">{formatPrice(item.price, currency)}</span>
            </button>
          );
        })}
      </div>

      {options.services.length === 0 && options.packages.length === 0 && (
        <div className="bk-empty">
          <Layers />
          <b>Пока нечего выбрать</b>
          <p>Фотограф ещё не добавил услуги. Напишите ему напрямую — он подскажет свободное время.</p>
        </div>
      )}

      {!options.schedule.accepting && (
        <div className="bk-note bk-note--warning">
          Онлайн-запись сейчас приостановлена — заявку всё равно можно отправить, фотограф свяжется с вами.
        </div>
      )}
    </div>
  );
}
