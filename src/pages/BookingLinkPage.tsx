import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  Copy,
  Home,
  Link2,
  RefreshCw,
  TriangleAlert,
  XCircle
} from 'lucide-react';
import { BrandMark } from '../components/ui/BrandMark';
import { BookingTimeline } from '../components/bookings/BookingTimeline';
import { ClientHero } from '../components/client/ClientHero';
import { ClientPanels, type ClientTabItem } from '../components/client/ClientPanels';
import { ClientDetails } from '../components/client/ClientDetails';
import { ClientHelp } from '../components/client/ClientHelp';
import { ClientRescheduleModal } from '../components/client/ClientRescheduleModal';
import { ClientCancelModal } from '../components/client/ClientCancelModal';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../lib/api';
import { formatDayTime, plural } from '../lib/utils';
import type { ClientBookingView } from '../types';

type PageState = 'loading' | 'ready' | 'missing' | 'error';
type TabId = 'details' | 'history' | 'help';

export function BookingLinkPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { branding } = useSettings();
  const { toast } = useToast();

  const [view, setView] = useState<ClientBookingView | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [tab, setTab] = useState<TabId>('details');
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const statusRef = useRef<string | null>(null);
  const timezone = view?.studio.timezone || branding.timezone;

  const apply = useCallback(
    (next: ClientBookingView, notify = false) => {
      const previous = statusRef.current;
      statusRef.current = next.status?.name || null;
      setView(next);
      setState('ready');
      if (notify && previous && next.status?.name && previous !== next.status.name) {
        toast({
          title: `Статус обновлён: ${next.status.name}`,
          subtitle: next.booking.localDate === next.today ? 'Съёмка сегодня' : 'Подробности в карточке',
          variant: next.status.isCancelled ? 'error' : 'success'
        });
      }
    },
    [toast]
  );

  const load = useCallback(
    async (silent = false) => {
      if (!code) {
        setState('missing');
        return;
      }
      if (!silent) setState('loading');
      try {
        const data = await api.get<ClientBookingView>(`/public/bookings/${encodeURIComponent(code)}`);
        apply(data, silent);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setState('missing');
          return;
        }
        if (!silent) setState('error');
      }
    },
    [code, apply]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* Живые обновления: SSE + редкий опрос как страховка на serverless-хостинге. */
  useEffect(() => {
    if (!code) return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`/api/public/bookings/${encodeURIComponent(code)}/stream`);
      source.addEventListener('hello', () => setLive(true));
      source.addEventListener('booking', () => void load(true));
      source.onerror = () => setLive(false);
    } catch {
      setLive(false);
    }

    const poll = setInterval(() => void load(true), 45000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      source?.close();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      setLive(false);
    };
  }, [code, load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="cp cp--loading">
        <div className="cp__shell">
          <span className="skeleton cp-skeleton cp-skeleton--hero" />
          <span className="skeleton cp-skeleton" />
          <span className="skeleton cp-skeleton cp-skeleton--tall" />
        </div>
      </div>
    );
  }

  if (state !== 'ready' || !view) {
    return (
      <div className="statuspage">
        <div className="statuspage__card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <BrandMark size={46} title={branding.siteName} />
          </div>
          <div className="statuspage__icon">
            {state === 'missing' ? <Link2 /> : <TriangleAlert />}
          </div>
          <h1 className="statuspage__title">
            {state === 'missing' ? 'Ссылка не найдена' : 'Не удалось открыть запись'}
          </h1>
          <p className="statuspage__text">
            {state === 'missing'
              ? 'Возможно, ссылка скопирована не полностью или запись удалена. Попросите фотографа прислать её заново — или оставьте новую заявку.'
              : 'Проверьте соединение и попробуйте ещё раз. Ничего не потерялось — запись сохранена.'}
          </p>
          <div className="statuspage__actions">
            {state === 'missing' ? (
              <Link to="/booking" className="btn btn--primary">
                <CalendarDays /> Записаться на съёмку
              </Link>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => void load()}>
                <RefreshCw /> Повторить
              </button>
            )}
            <Link to="/" className="btn btn--ghost">
              <Home /> На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { booking, permissions, studio, events } = view;
  const tabs: ClientTabItem[] = [
    { id: 'details', label: 'Детали' },
    { id: 'history', label: 'История', badge: events.length },
    { id: 'help', label: 'Помощь' }
  ];

  const historyPanel = (
    <div className="cp-cards">
      <article className="cp-card">
        <header className="cp-card__head">
          <span className="cp-card__icon">
            <CalendarClock />
          </span>
          <div>
            <h3>Что происходило с записью</h3>
            <p className="cp-card__sub">
              {events.length} {plural(events.length, 'событие', 'события', 'событий')} · обновляется само
            </p>
          </div>
        </header>
        <BookingTimeline events={events} timezone={timezone} />
      </article>

      <div className="cp-hint">
        <RefreshCw />
        <span>
          Страница обновляется сама: подтверждение, перенос и готовые кадры появятся здесь без перезагрузки.
        </span>
      </div>
    </div>
  );

  return (
    <div className="cp">
      <header className="cp__bar">
        <Link to="/" className="cp__brand">
          <BrandMark size={30} title={studio.siteName} />
          <span>
            <b>{studio.photographerName || studio.siteName}</b>
            <em>{studio.siteName}</em>
          </span>
        </Link>
        <span className="cp__code">
          <Link2 />
          {booking.code}
          <button type="button" onClick={() => void copyLink()} aria-label="Скопировать ссылку">
            {copied ? <Check /> : <Copy />}
          </button>
        </span>
      </header>

      <main className="cp__shell">
        <ClientHero view={view} />

        <div className="cp__livebar">
          <span className="cp__live" data-live={live || undefined}>
            <i aria-hidden />
            {live ? 'Обновляется автоматически' : 'Страница вашей съёмки'}
          </span>
          <span className="cp__created">
            {booking.createdAt ? `заявка от ${formatDayTime(booking.createdAt, timezone)}` : ''}
          </span>
        </div>

        <ClientPanels tabs={tabs} value={tab} onChange={(id) => setTab(id as TabId)}>
          <ClientDetails view={view} />
          {historyPanel}
          <ClientHelp view={view} />
        </ClientPanels>

        <section className="cp-actions">
          <header className="cp-actions__head">
            <h3>Управление записью</h3>
            <span>
              {permissions.canReschedule || permissions.canCancel
                ? 'До съёмки можно всё поменять сами'
                : 'Изменения уже недоступны'}
            </span>
          </header>

          <div className="cp-actions__row">
            <button
              type="button"
              className="btn btn--primary cp-actions__btn"
              onClick={() => setRescheduleOpen(true)}
              disabled={!permissions.canReschedule}
            >
              <CalendarClock /> Перенести съёмку
            </button>
            <button
              type="button"
              className="btn cp-actions__btn"
              onClick={() => setCancelOpen(true)}
              disabled={!permissions.canCancel}
            >
              <XCircle /> Отменить
            </button>
          </div>

          {!view.status?.isCancelled && !view.status?.isFinal && !permissions.canReschedule && permissions.rescheduleReason && (
            <p className="cp-actions__note">{permissions.rescheduleReason}</p>
          )}
          {!view.status?.isCancelled && !view.status?.isFinal && !permissions.canCancel && permissions.cancelReason && (
            <p className="cp-actions__note">{permissions.cancelReason}</p>
          )}
          {permissions.canCancel && permissions.canReschedule && permissions.lateCancel && (
            <p className="cp-actions__note cp-actions__note--warn">
              До съёмки меньше {permissions.minNoticeHours} ч: лучше не отменять, а позвонить — возможно,
              получится просто сдвинуть время.
            </p>
          )}
        </section>

        <footer className="cp__foot">
          <span>
            {studio.siteName} · {studio.brandTagline}
          </span>
          <Link to="/booking" className="cp__foot-link">
            Записаться ещё раз <ArrowRight />
          </Link>
        </footer>
      </main>

      <div className="cp-dock" data-hidden={(!permissions.canReschedule && !permissions.canCancel) || undefined}>
        {permissions.canReschedule && (
          <button type="button" className="btn btn--primary cp-dock__btn" onClick={() => setRescheduleOpen(true)}>
            <CalendarClock /> Перенести
          </button>
        )}
        {permissions.canCancel && (
          <button type="button" className="btn cp-dock__btn" onClick={() => setCancelOpen(true)}>
            <XCircle /> Отменить
          </button>
        )}
      </div>

      <ClientRescheduleModal
        view={view}
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        onDone={(next) => {
          apply(next);
          setTab('details');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast({
            title: 'Съёмка перенесена',
            subtitle: `${next.booking.localDate} в ${next.booking.localTime}`,
            variant: 'success'
          });
        }}
      />

      <ClientCancelModal
        view={view}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onDone={(next) => {
          apply(next);
          toast({
            title: 'Запись отменена',
            subtitle: 'Фотограф получил уведомление',
            variant: 'success'
          });
        }}
      />
    </div>
  );
}
