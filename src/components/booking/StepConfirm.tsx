import { Mail, MessageSquare, Pencil, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CodeInput } from './CodeInput';
import { BookingSummary } from './BookingSummary';
import type { BookingDraft, BookingFormOptions, PriceQuote } from '../../types';

export function StepConfirm({
  options,
  draft,
  item,
  totals,
  quote,
  promoInput,
  promoCode,
  promoError,
  promoBusy,
  onPromoInput,
  onApplyPromo,
  onClearPromo,
  showBonus = false,
  useBonus = false,
  onToggleBonus,
  requireVerification,
  code,
  onCode,
  codeComplete,
  codeError,
  seconds,
  onResend,
  onEditPhone,
  sentTo,
  devCode
}: {
  options: BookingFormOptions;
  draft: BookingDraft;
  item: { kind: 'service' | 'package'; name: string; duration: number; price: number } | null;
  totals: {
    base: number;
    extras: number;
    total: number;
    lines: { addon: { id: string; name: string }; total: number; qty: number }[];
  };
  quote: PriceQuote | null;
  promoInput: string;
  promoCode: string;
  promoError: string | null;
  promoBusy: boolean;
  onPromoInput: (value: string) => void;
  onApplyPromo: () => void;
  onClearPromo: () => void;
  showBonus?: boolean;
  useBonus?: boolean;
  onToggleBonus?: (value: boolean) => void;
  requireVerification: boolean;
  code: string;
  onCode: (value: string) => void;
  codeComplete?: (value: string) => void;
  codeError: string | null;
  seconds: number;
  onResend: () => void;
  onEditPhone: () => void;
  sentTo: string;
  devCode?: string | null;
}) {
  return (
    <div className="bk-step-inner">
      <header className="bk-step-head">
        <h2>{requireVerification ? 'Подтвердите номер' : 'Проверьте запись'}</h2>
        <p>
          {requireVerification
            ? `Мы отправили код на ${sentTo}. Введите его, чтобы фотограф принял заявку.`
            : 'Всё готово — осталось отправить заявку фотографу.'}
        </p>
      </header>

      {requireVerification ? (
        <div className="bk-verify">
          <div className="bk-verify__phone">
            <span className="bk-verify__icon">
              <MessageSquare />
            </span>
            <div>
              <b>{sentTo}</b>
              <button type="button" onClick={onEditPhone}>
                <Pencil /> изменить номер
              </button>
            </div>
            <span className="bk-verify__shield">
              <ShieldCheck /> защищено
            </span>
          </div>

          <CodeInput value={code} onChange={onCode} onComplete={codeComplete} invalid={Boolean(codeError)} />

          {codeError && (
            <div className="bk-error" role="alert">
              <TriangleAlert /> {codeError}
            </div>
          )}

          <div className="bk-verify__actions">
            {seconds > 0 ? (
              <span className="bk-verify__timer">
                Отправить снова через <b className="tnum">{seconds} с</b>
              </span>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onResend}>
                Отправить код ещё раз
              </button>
            )}
            <span className="bk-verify__hint">
              {seconds > 0 ? 'Код действует 10 минут' : 'Шесть цифр из сообщения'}
            </span>
          </div>

          {devCode && (
            <div className="bk-note bk-note--demo">
              <Mail /> Демо-режим: SMS не отправляется, код — <b className="tnum">{devCode}</b>
            </div>
          )}
        </div>
      ) : (
        <div className="bk-note bk-note--ok">
          <ShieldCheck /> Заявка уйдёт фотографу сразу. Подтверждение придёт в уведомлении.
        </div>
      )}

      <BookingSummary
        options={options}
        draft={draft}
        item={item}
        totals={totals}
        quote={quote}
        promoInput={promoInput}
        promoCode={promoCode}
        promoError={promoError}
        promoBusy={promoBusy}
        onPromoInput={onPromoInput}
        onApplyPromo={onApplyPromo}
        onClearPromo={onClearPromo}
        showBonus={showBonus}
        useBonus={useBonus}
        onToggleBonus={onToggleBonus}
      />
    </div>
  );
}
