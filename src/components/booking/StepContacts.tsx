import { AtSign, Camera, Mail, Phone, User } from 'lucide-react';
import { maskPhone } from '../../lib/booking';
import type { BookingDraft, BookingFormOptions } from '../../types';

export function StepContacts({
  options,
  draft,
  errors,
  onChange,
  verificationHint
}: {
  options: BookingFormOptions;
  draft: BookingDraft;
  errors: Record<string, string>;
  onChange: (patch: Partial<BookingDraft>) => void;
  verificationHint: boolean;
}) {
  return (
    <div className="bk-step-inner">
      <header className="bk-step-head">
        <h2>Как с вами связаться?</h2>
        <p>
          {verificationHint
            ? 'Пришлём код подтверждения на телефон — так фотограф точно знает, что связь с вами настоящая.'
            : 'Фотограф свяжется, чтобы подтвердить детали съёмки.'}
        </p>
      </header>

      <div className="bk-form">
        <label className="field">
          <span className="field__label">Имя</span>
          <span className="input-wrap">
            <User />
            <input
              className={`input${errors.name ? ' input--invalid' : ''}`}
              value={draft.name}
              autoComplete="name"
              placeholder="Как к вам обращаться"
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </span>
          {errors.name && <span className="field__error">{errors.name}</span>}
        </label>

        <label className="field">
          <span className="field__label">Телефон</span>
          <span className="input-wrap">
            <Phone />
            <input
              className={`input${errors.phone ? ' input--invalid' : ''}`}
              value={draft.phone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+375 29 123-45-67"
              onChange={(event) => onChange({ phone: maskPhone(event.target.value) })}
            />
          </span>
          {errors.phone ? (
            <span className="field__error">{errors.phone}</span>
          ) : (
            <span className="field__hint">На этот номер придёт код подтверждения</span>
          )}
        </label>

        <label className="field">
          <span className="field__label">
            Почта <span className="bk-optional">необязательно</span>
          </span>
          <span className="input-wrap">
            <Mail />
            <input
              className={`input${errors.email ? ' input--invalid' : ''}`}
              value={draft.email}
              type="email"
              autoComplete="email"
              placeholder="you@mail.ru"
              onChange={(event) => onChange({ email: event.target.value })}
            />
          </span>
          {errors.email && <span className="field__error">{errors.email}</span>}
        </label>

        {options.form.askInstagram && (
          <label className="field">
            <span className="field__label">
              Instagram <span className="bk-optional">необязательно</span>
            </span>
            <span className="input-wrap">
              <Camera />
              <input
                className="input"
                value={draft.instagram}
                placeholder="@nickname"
                onChange={(event) => onChange({ instagram: event.target.value })}
              />
            </span>
          </label>
        )}
      </div>

      {options.agreement.enabled && (
        <label className="checkbox bk-agreement">
          <input
            type="checkbox"
            checked={draft.agreed}
            onChange={(event) => onChange({ agreed: event.target.checked })}
          />
          <span className="checkbox__box" aria-hidden />
          <span>{options.agreement.consentText || 'Согласен с условиями съёмки и обработкой данных'}</span>
        </label>
      )}

      {options.agreement.enabled && options.agreement.text && (
        <details className="bk-agreement-text">
          <summary>
            <AtSign /> Условия съёмки
          </summary>
          <p>{options.agreement.text}</p>
        </details>
      )}
    </div>
  );
}
