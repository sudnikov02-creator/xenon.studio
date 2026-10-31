import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, Send, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatPrice } from '../../lib/services';
import {
  EMPTY_DRAFT,
  buildAddonsPayload,
  contactErrors,
  draftTotal,
  isStepValid,
  maskPhone,
  selectedItem
} from '../../lib/booking';
import { BookingStepper } from './BookingStepper';
import { StepService } from './StepService';
import { StepSchedule } from './StepSchedule';
import { StepDetails } from './StepDetails';
import { StepContacts } from './StepContacts';
import { StepConfirm } from './StepConfirm';
import { BookingSuccess } from './BookingSuccess';
import type {
  AvailabilityResponse,
  BookingDraft,
  BookingFormOptions,
  CreatedBooking,
  SlotsResponse
} from '../../types';

type Variant = 'public' | 'admin';

export function BookingWizard({ variant = 'public', onClose }: { variant?: Variant; onClose?: () => void }) {
  const [options, setOptions] = useState<BookingFormOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);
  const [month, setMonth] = useState('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedBooking | null>(null);
  const submittingRef = useRef(false);

  const requireVerification = variant === 'public' && Boolean(options?.form.requireVerification);
  const item = useMemo(() => selectedItem(options, draft), [options, draft]);
  const totals = useMemo(() => draftTotal(item, draft), [item, draft]);
  const currency = options?.branding.currencySymbol || '₽';
  const errors = useMemo(() => (showErrors ? contactErrors(draft) : {}), [draft, showErrors]);

  useEffect(() => {
    let alive = true;
    api
      .get<BookingFormOptions>('/public/booking/options')
      .then((data) => {
        if (!alive) return;
        setOptions(data);
        setMonth(data.month);
        setDevCode(null);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(err instanceof ApiError ? err.message : 'Не удалось загрузить форму записи');
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadAvailability = useCallback(
    async (targetMonth: string, serviceId: number | null, packageId: number | null) => {
      setLoadingMonth(true);
      try {
        const query = new URLSearchParams({ month: targetMonth });
        if (serviceId) query.set('serviceId', String(serviceId));
        if (packageId) query.set('packageId', String(packageId));
        const data = await api.get<AvailabilityResponse>(`/public/booking/availability?${query.toString()}`);
        setAvailability(data);
      } catch {
        setAvailability(null);
      } finally {
        setLoadingMonth(false);
      }
    },
    []
  );

  const loadSlots = useCallback(
    async (date: string, serviceId: number | null, packageId: number | null) => {
      setLoadingSlots(true);
      try {
        const query = new URLSearchParams({ date });
        if (serviceId) query.set('serviceId', String(serviceId));
        if (packageId) query.set('packageId', String(packageId));
        const data = await api.get<SlotsResponse>(`/public/booking/slots?${query.toString()}`);
        setSlots(data);
      } catch {
        setSlots(null);
      } finally {
        setLoadingSlots(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!options || step !== 1) return;
    void loadAvailability(month || options.month, draft.serviceId, draft.packageId);
  }, [options, step, month, draft.serviceId, draft.packageId, loadAvailability]);

  useEffect(() => {
    if (!options || step !== 1 || !draft.date) return;
    void loadSlots(draft.date, draft.serviceId, draft.packageId);
  }, [options, step, draft.date, draft.serviceId, draft.packageId, loadSlots]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const patch = useCallback((change: Partial<BookingDraft>) => {
    setDraft((prev) => ({ ...prev, ...change }));
    setSubmitError(null);
    if ('name' in change || 'phone' in change || 'email' in change) {
      setShowErrors(false);
    }
  }, []);

  const goTo = (next: number, dir: 'forward' | 'back' = 'forward') => {
    setDirection(dir);
    setStep(next);
  };

  const requestCode = useCallback(
    async (resend = false) => {
      setCodeError(null);
      setSubmitError(null);
      try {
        const data = await api.post<{ phonePretty: string; devCode?: string; resendAfterSec: number }>(
          '/public/booking/verify/start',
          { phone: draft.phone }
        );
        setSentTo(data.phonePretty || draft.phone);
        setDevCode(data.devCode || null);
        setSeconds(resend ? 60 : data.resendAfterSec || 60);
        setCode('');
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Не удалось отправить код';
        setCodeError(message);
        setSubmitError(message);
        return false;
      }
    },
    [draft.phone]
  );

  const submit = useCallback(
    async (token?: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const payload = {
          name: draft.name.trim(),
          phone: draft.phone,
          email: draft.email.trim(),
          instagram: draft.instagram.trim(),
          note: draft.note.trim(),
          agreed: draft.agreed,
          serviceId: draft.serviceId,
          packageId: draft.packageId,
          date: draft.date,
          time: draft.time,
          addons: buildAddonsPayload(draft),
          verificationToken: token
        };
        const data = await api.post<CreatedBooking>(
          variant === 'admin' ? '/bookings' : '/public/booking',
          payload
        );
        setCreated(data);
      } catch (err) {
        const apiError = err instanceof ApiError ? err : null;
        const message = apiError?.message || 'Не удалось отправить заявку';
        if (apiError?.code === 'slot_taken') {
          setSubmitError('Это время только что заняли. Выберите другое — свободные слоты обновились.');
          setStep(1);
          setDirection('back');
          if (draft.date) void loadSlots(draft.date, draft.serviceId, draft.packageId);
          if (options) void loadAvailability(month || options.month, draft.serviceId, draft.packageId);
        } else if (apiError?.code === 'phone_not_verified') {
          setCodeError(message);
          setSubmitError(message);
          goTo(4);
        } else {
          setSubmitError(message);
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [draft, variant, loadSlots, loadAvailability, options, month]
  );

  const confirmCode = useCallback(
    async (value: string) => {
      if (value.length !== 6 || submitting) return;
      setCodeError(null);
      try {
        const data = await api.post<{ token: string; phone: string }>('/public/booking/verify/confirm', {
          phone: draft.phone,
          code: value
        });
        await submit(data.token);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Не удалось проверить код';
        setCodeError(message);
      }
    },
    [draft.phone, submit, submitting]
  );

  const advance = async () => {
    if (!options) return;
    if (!isStepValid(step, draft, options)) {
      if (step === 3) setShowErrors(true);
      return;
    }
    if (step === 3) {
      if (requireVerification) {
        setSubmitting(true);
        const ok = await requestCode();
        setSubmitting(false);
        if (!ok) return;
      }
      goTo(4);
      return;
    }
    if (step === 4) {
      if (requireVerification) {
        void confirmCode(code);
      } else {
        void submit();
      }
      return;
    }
    goTo(Math.min(4, step + 1));
  };

  const back = () => {
    if (step === 0) return;
    goTo(step - 1, 'back');
    setSubmitError(null);
    setCodeError(null);
  };

  const reset = () => {
    setCreated(null);
    setDraft(EMPTY_DRAFT);
    setStep(0);
    setDirection('forward');
    setCode('');
    setCodeError(null);
    setDevCode(null);
    setSeconds(0);
    setShowErrors(false);
    setSubmitError(null);
    if (options) setMonth(options.month);
  };

  if (loadError) {
    return (
      <div className="bk-loading">
        <span className="bk-loading__icon">
          <TriangleAlert />
        </span>
        <b>Форма записи недоступна</b>
        <p>{loadError}</p>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="bk-loading" aria-busy="true">
        <span className="skeleton" style={{ width: 200, height: 22, borderRadius: 8 }} />
        <span className="skeleton" style={{ width: '100%', height: 88, borderRadius: 14, marginTop: 18 }} />
        <span className="skeleton" style={{ width: '100%', height: 88, borderRadius: 14, marginTop: 10 }} />
        <span className="skeleton" style={{ width: '100%', height: 88, borderRadius: 14, marginTop: 10 }} />
      </div>
    );
  }

  if (created) {
    return (
      <BookingSuccess
        created={created}
        today={options.today}
        currencySymbol={currency}
        decimalSeparator={options.branding.decimalSeparator}
        variant={variant}
        onReset={reset}
        onClose={onClose}
      />
    );
  }

  const nextLabel =
    step === 0
      ? 'Выбрать время'
      : step === 1
        ? 'К деталям'
        : step === 2
          ? 'К контактам'
          : step === 3
            ? requireVerification
              ? 'Получить код'
              : 'Продолжить'
            : variant === 'admin'
              ? 'Создать запись'
              : requireVerification
                ? 'Подтвердить и отправить'
                : 'Отправить заявку';

  const nextDisabled =
    submitting ||
    (step === 0 && !item) ||
    (step === 1 && !(draft.date && draft.time)) ||
    (step === 4 && requireVerification && code.length !== 6);

  return (
    <div className="bk" data-variant={variant}>
      {variant === 'public' && (
        <header className="bk__brand">
          <div>
            <b>{options.branding.photographerName}</b>
            <span>{options.branding.siteName}</span>
          </div>
          <span className="bk__hint">
            <CalendarClock /> Запись на съёмку
          </span>
        </header>
      )}

      <BookingStepper step={step} />

      <div className="bk__body">
        <div className="bk-slide" data-dir={direction} key={step}>
          {step === 0 && <StepService options={options} draft={draft} onSelect={patch} />}
          {step === 1 && (
            <StepSchedule
              options={options}
              draft={draft}
              month={month || options.month}
              availability={availability}
              slots={slots}
              loadingMonth={loadingMonth}
              loadingSlots={loadingSlots}
              onMonthChange={(next) => {
                setMonth(next);
                setSlots(null);
                if (draft.date && !draft.date.startsWith(next)) patch({ date: '', time: '' });
              }}
              onSelectDate={(date) => patch({ date, time: '' })}
              onSelectTime={(time) => patch({ time })}
            />
          )}
          {step === 2 && (
            <StepDetails options={options} draft={draft} item={item} total={totals.total} onChange={patch} />
          )}
          {step === 3 && (
            <StepContacts
              options={options}
              draft={draft}
              errors={errors}
              onChange={patch}
              verificationHint={requireVerification}
            />
          )}
          {step === 4 && (
            <StepConfirm
              options={options}
              draft={draft}
              item={item}
              totals={totals}
              requireVerification={requireVerification}
              code={code}
              onCode={(value) => {
                setCode(value);
                setCodeError(null);
              }}
              codeComplete={(value) => void confirmCode(value)}
              codeError={codeError}
              seconds={seconds}
              onResend={() => void requestCode(true)}
              onEditPhone={() => goTo(3, 'back')}
              sentTo={sentTo || maskPhone(draft.phone)}
              devCode={devCode}
            />
          )}
        </div>
      </div>

      {submitError && (
        <div className="bk__alert" role="alert">
          <TriangleAlert /> {submitError}
        </div>
      )}

      <footer className="bk__foot">
        <button
          type="button"
          className="btn btn--ghost bk__back"
          onClick={back}
          disabled={step === 0 || submitting}
          aria-label="Назад"
        >
          <ArrowLeft />
          <span>Назад</span>
        </button>

        <div className="bk__total">
          <span>{item ? item.name : 'Выберите услугу'}</span>
          <b className="tnum">{formatPrice(totals.total, currency)}</b>
        </div>

        <button
          type="button"
          className={`btn btn--primary bk__next${submitting ? ' btn--loading' : ''}`}
          onClick={() => void advance()}
          disabled={nextDisabled}
        >
          {step === 4 ? <Send /> : step === 0 ? <CalendarClock /> : <ArrowRight />}
          <span>{nextLabel}</span>
        </button>
      </footer>

      {step > 0 && (
        <div className="bk__progress" aria-hidden>
          <span style={{ width: `${((step + 1) / 5) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
