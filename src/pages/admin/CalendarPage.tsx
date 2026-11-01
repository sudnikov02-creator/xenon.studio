import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { BookingDrawer } from '../../components/bookings/BookingDrawer';
import { QuickBookingModal } from '../../components/layout/QuickBookingModal';
import { useToast } from '../../context/ToastContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useSettings } from '../../context/SettingsContext';
import { api, ApiError } from '../../lib/api';
import { formatMoney, plural } from '../../lib/utils';
import type {
  BookingStatusInfo,
  BookingStatusesPayload,
  CalendarDay,
  CalendarEntry,
  CalendarPayload,
  CalendarView,
  ExternalCalendarEvent
} from '../../types';

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' }
];

const MONTHS_NOM = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь'
];

const MONTHS_GEN = [
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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function clock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

function addDaysKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonthsKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, Math.min(day, 28)));
  return date.toISOString().slice(0, 10);
}

function rangeLabel(payload: CalendarPayload): string {
  const fromMonth = Number(payload.from.slice(5, 7));
  const toMonth = Number(payload.to.slice(5, 7));
  const fromDay = Number(payload.from.slice(8, 10));
  const toDay = Number(payload.to.slice(8, 10));

  if (payload.view === 'day') {
    return `${fromDay} ${MONTHS_GEN[fromMonth - 1]} ${payload.from.slice(0, 4)}`;
  }
  if (payload.view === 'week') {
    if (fromMonth === toMonth) return `${fromDay}–${toDay} ${MONTHS_GEN[fromMonth - 1]}`;
    return `${fromDay} ${MONTHS_GEN[fromMonth - 1]} — ${toDay} ${MONTHS_GEN[toMonth - 1]}`;
  }
  return `${MONTHS_NOM[Number(payload.date.slice(5, 7)) - 1]} ${payload.date.slice(0, 4)}`;
}

export function CalendarPage() {
  const { toast } = useToast();
  const { subscribe } = useRealtime();
  const { branding } = useSettings();

  const [view, setView] = useState<CalendarView>(() => {
    const stored = localStorage.getItem('xenon.calendar.view');
    return stored === 'day' || stored === 'week' || stored === 'month' ? stored : 'month';
  });
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [statuses, setStatuses] = useState<BookingStatusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [syncOpen, setSyncOpen] = useState(false);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [external, setExternal] = useState<ExternalCalendarEvent[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const payload = await api.get<CalendarPayload>(`/calendar?view=${view}&date=${date}`);
        setData(payload);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить календарь');
      } finally {
        setLoading(false);
      }
    },
    [view, date]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem('xenon.calendar.view', view);
  }, [view]);

  useEffect(() => {
    api
      .get<BookingStatusesPayload>('/bookings/statuses')
      .then((payload) => setStatuses(payload.statuses))
      .catch(() => setStatuses([]));
  }, []);

  useEffect(() => {
    const off = subscribe('booking', () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(true), 250);
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      off();
    };
  }, [subscribe, load]);

  const openSync = async () => {
    setSyncOpen(true);
    setSyncUrl(data?.calendar.url || '');
    try {
      const payload = await api.get<{ token: string }>('/calendar/export');
      setExportToken(payload.token);
    } catch {
      setExportToken(null);
    }
    try {
      const list = await api.get<{ items: ExternalCalendarEvent[] }>('/calendar/external');
      setExternal(list.items);
    } catch {
      setExternal([]);
    }
  };

  const feedUrl = useMemo(() => {
    if (!exportToken) return '';
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/api/public/calendar/${exportToken}.ics`;
  }, [exportToken]);

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({
        title: 'Ссылка скопирована',
        subtitle: 'Apple Calendar → «Новая подписка на календарь»',
        variant: 'success'
      });
    } catch {
      toast({ title: 'Не удалось скопировать', variant: 'error' });
    }
  };

  const rotateFeed = async () => {
    try {
      const payload = await api.post<{ token: string }>('/calendar/export/rotate', {});
      setExportToken(payload.token);
      toast({ title: 'Ссылка обновлена', subtitle: 'Старая подписка перестанет работать', variant: 'success' });
    } catch {
      toast({ title: 'Не удалось обновить ссылку', variant: 'error' });
    }
  };

  const sync = async () => {
    if (!syncUrl.trim()) {
      toast({ title: 'Вставьте ссылку на .ics', variant: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const result = await api.post<{ imported: number }>('/calendar/sync', { url: syncUrl.trim() });
      toast({
        title: result.imported ? 'Календарь синхронизирован' : 'Событий не найдено',
        subtitle: `Импортировано: ${result.imported}`,
        variant: 'success'
      });
      const list = await api.get<{ items: ExternalCalendarEvent[] }>('/calendar/external');
      setExternal(list.items);
      await load(true);
    } catch (err) {
      toast({
        title: 'Синхронизация не удалась',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setSyncing(false);
    }
  };

  const clearExternal = async () => {
    setClearing(true);
    try {
      await api.del('/calendar/external');
      setExternal([]);
      setClearOpen(false);
      toast({ title: 'Внешние события удалены', subtitle: 'Слоты снова свободны', variant: 'success' });
      await load(true);
    } catch {
      toast({ title: 'Не удалось очистить', variant: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const shift = (direction: 1 | -1) => {
    if (view === 'day') setDate((prev) => addDaysKey(prev, direction));
    else if (view === 'week') setDate((prev) => addDaysKey(prev, direction * 7));
    else setDate((prev) => addMonthsKey(prev, direction));
  };

  const money = (value: number) => formatMoney(value, branding.currencySymbol, branding.decimalSeparator);

  const handleEntry = (entry: CalendarEntry) => setDetailId(entry.id);

  const subtitle = data
    ? `${data.totals.bookings} ${plural(data.totals.bookings, 'запись', 'записи', 'записей')} · ${money(
        data.totals.revenue
      )} · ${data.totals.pending} ${plural(data.totals.pending, 'ждёт ответа', 'ждут ответа', 'ждут ответа')} · ${
        data.totals.external
      } ${plural(data.totals.external, 'личное событие', 'личных события', 'личных событий')}`
    : 'Загрузка расписания';

  return (
    <div className="page cal-page">
      <PageHead
        title="Календарь"
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
              <RefreshCw />
            </button>
            <button type="button" className="btn btn--bordered" onClick={() => void openSync()}>
              <Link2 /> <span>Apple Calendar</span>
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
              <Plus /> <span>Запись</span>
            </button>
          </>
        }
      />

      <div className="card cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn btn--icon btn--bordered" onClick={() => shift(-1)} aria-label="Назад">
            <ChevronLeft />
          </button>
          <button type="button" className="btn btn--icon btn--bordered" onClick={() => shift(1)} aria-label="Вперёд">
            <ChevronRight />
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDate(data?.today || date)}>
            Сегодня
          </button>
          <b className="cal-nav__label">{data ? rangeLabel(data) : ''}</b>
        </div>

        <div className="cal-views" role="tablist" aria-label="Вид календаря">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              className="cal-view"
              data-active={view === item.id || undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && !loading && (
        <div className="cal-error" role="alert">
          <TriangleAlert /> <span>{error}</span>
        </div>
      )}

      {loading && !data && <div className="skeleton cal-skeleton" />}

      {data && view === 'month' && (
        <div className="card cal-month">
          <div className="cal-month__head">
            {data.weekdays.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="cal-month__grid">
            {data.days.map((day) => {
              const outside = Number(day.date.slice(5, 7)) !== Number(data.date.slice(5, 7));
              return (
                <button
                  type="button"
                  key={day.date}
                  className="cal-cell"
                  data-outside={outside || undefined}
                  data-today={day.isToday || undefined}
                  data-closed={day.closed || undefined}
                  onClick={() => {
                    setDate(day.date);
                    setView('day');
                  }}
                >
                  <span className="cal-cell__num">
                    {day.day}
                    {day.count > 0 && <em>{day.count}</em>}
                  </span>
                  <span className="cal-cell__rows">
                    {day.bookings.slice(0, 3).map((entry) => (
                      <span
                        key={entry.id}
                        className="cal-pill"
                        data-initial={entry.status?.isInitial || undefined}
                        style={{ ['--pill-color' as string]: entry.status?.color || '#2563eb' }}
                        title={`${entry.time} · ${entry.client?.name || 'Клиент'} · ${entry.item.name}`}
                      >
                        <i />
                        {entry.time} {entry.client?.name?.split(' ')[0] || ''}
                      </span>
                    ))}
                    {day.external.slice(0, 1).map((item) => (
                      <span key={item.id} className="cal-pill" data-external>
                        <i />
                        {item.title}
                      </span>
                    ))}
                    {day.count + day.external.length > 4 && (
                      <span className="cal-cell__more">+{day.count + day.external.length - 4}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data && view === 'week' && (
        <div className="card cal-week">
          {data.days.map((day) => (
            <button
              type="button"
              key={day.date}
              className="cal-week__day"
              data-today={day.isToday || undefined}
              data-closed={day.closed || undefined}
              onClick={() => {
                setDate(day.date);
                setView('day');
              }}
            >
              <header>
                <span>{day.weekday}</span>
                <b data-today={day.isToday || undefined}>{day.day}</b>
              </header>
              <div className="cal-week__slots">
                {day.closed && day.bookings.length === 0 && <span className="cal-week__off">Выходной</span>}
                {day.bookings.map((entry) => (
                  <span
                    key={entry.id}
                    className="cal-pill cal-pill--wide"
                    data-initial={entry.status?.isInitial || undefined}
                    style={{ ['--pill-color' as string]: entry.status?.color || '#2563eb' }}
                  >
                    <i />
                    {entry.time} {entry.client?.name?.split(' ')[0] || ''}
                  </span>
                ))}
                {day.external.map((item) => (
                  <span key={item.id} className="cal-pill cal-pill--wide" data-external>
                    <i />
                    {item.allDay ? item.title : `${clock(item.startMin)} ${item.title}`}
                  </span>
                ))}
                {!day.closed && day.bookings.length === 0 && day.external.length === 0 && (
                  <span className="cal-week__free">свободно</span>
                )}
              </div>
              <footer>{day.revenue > 0 && <span className="tnum">{money(day.revenue)}</span>}</footer>
            </button>
          ))}
        </div>
      )}

      {data && view === 'day' && data.days[0] && (
        <div className="card cal-day">
          <header className="cal-day__head">
            <div>
              <b>
                {data.days[0].weekday}, {data.days[0].day} {MONTHS_GEN[data.days[0].month - 1]}
              </b>
              <span>
                {data.days[0].closed
                  ? 'Выходной день'
                  : data.days[0].windows.map((window) => `${clock(window.from)}–${clock(window.to)}`).join(' · ') ||
                    'Нет рабочих часов'}
              </span>
            </div>
            <div className="cal-day__sum">
              <span className="tnum">{money(data.days[0].revenue)}</span>
              <em>
                {data.days[0].count} {plural(data.days[0].count, 'запись', 'записи', 'записей')}
              </em>
            </div>
          </header>

          <div className="cal-timeline">
            {data.days[0].windows.length === 0 && (
              <div className="cal-timeline__closed">
                <TriangleAlert />
                <span>В этот день студия не работает — запись недоступна, но добавить её можно вручную.</span>
              </div>
            )}

            {data.days[0].windows.map((window) =>
              Array.from({ length: Math.ceil((window.to - window.from) / 60) }).map((_, index) => {
                const from = window.from + index * 60;
                const to = Math.min(from + 60, window.to);
                const entries = data.days[0].bookings.filter((item) => item.startMin < to && item.endMin > from);
                const blocked = data.days[0].external.filter((item) => item.startMin < to && item.endMin > from);
                const free = entries.length === 0 && blocked.length === 0;
                return (
                  <div className="cal-hour" key={`${window.from}-${index}`}>
                    <span className="cal-hour__label">{clock(from)}</span>
                    <div className="cal-hour__body" data-free={free || undefined}>
                      {entries.map((entry) => (
                        <button
                          type="button"
                          key={entry.id}
                          className="cal-event"
                          style={{ ['--pill-color' as string]: entry.status?.color || '#2563eb' }}
                          data-initial={entry.status?.isInitial || undefined}
                          onClick={() => handleEntry(entry)}
                        >
                          <b>{entry.client?.name || 'Клиент'}</b>
                          <span>
                            <Clock3 /> {entry.time}–{entry.endTime} · {entry.item.name}
                          </span>
                          <em className="tnum">{money(entry.price)}</em>
                        </button>
                      ))}

                      {blocked.map((item) => (
                        <div className="cal-event cal-event--external" key={item.id}>
                          <b>{item.title}</b>
                          <span>
                            <CalendarDays />{' '}
                            {item.allDay ? 'весь день' : `${clock(item.startMin)}–${clock(item.endMin)}`}
                          </span>
                          <em>внешний календарь</em>
                        </div>
                      ))}

                      {free && (
                        <button type="button" className="cal-free" onClick={() => setCreateOpen(true)}>
                          <Plus /> свободно — добавить запись
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="cal-legend">
        <span>
          <i data-tone="wait" /> заявка ждёт ответа
        </span>
        <span>
          <i data-tone="ok" /> подтверждено
        </span>
        <span>
          <i data-tone="external" /> личное событие
        </span>
        {data?.calendar.lastSyncAt && (
          <span className="cal-legend__sync">
            <Check /> синхронизировано {new Date(data.calendar.lastSyncAt).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>

      <Modal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        title="Apple Calendar и внешние календари"
        subtitle="Подписка на записи студии и импорт личных событий"
        icon={<CalendarDays />}
        size="medium"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSyncOpen(false)}>
              Закрыть
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--primary" disabled={syncing} onClick={() => void sync()}>
              <RotateCw /> Синхронизировать
            </button>
          </>
        }
      >
        <div className="cal-sync">
          <section>
            <h4>
              <Check /> Записи в ваш календарь
            </h4>
            <p>Подписка только на чтение: в Apple Calendar появятся все съёмки студии и их статусы.</p>
            <div className="cal-sync__link">
              <input className="input" readOnly value={feedUrl || 'Готовим ссылку…'} aria-label="Ссылка подписки" />
              <button type="button" className="btn btn--bordered" onClick={() => void copyFeed()} disabled={!feedUrl}>
                {copied ? <Check /> : <Copy />}
              </button>
              <button
                type="button"
                className="btn btn--icon btn--ghost"
                onClick={() => void rotateFeed()}
                aria-label="Перевыпустить ссылку"
                title="Перевыпустить ссылку"
              >
                <RefreshCw />
              </button>
            </div>
            <span className="cal-sync__hint">Apple Calendar → Файл → Новая подписка на календарь → вставьте ссылку.</span>
          </section>

          <section>
            <h4>
              <Link2 /> Личные события закрывают слоты
            </h4>
            <p>Укажите ссылку на .ics своего календаря — события импортируются и блокируют это время в записи.</p>
            <div className="cal-sync__link">
              <input
                className="input"
                value={syncUrl}
                placeholder="https://pXX-caldav.icloud.com/published/…"
                aria-label="Ссылка на внешний календарь"
                onChange={(event) => setSyncUrl(event.target.value)}
              />
            </div>
            {data?.calendar.lastSyncError && (
              <span className="cal-sync__error">
                <TriangleAlert /> {data.calendar.lastSyncError}
              </span>
            )}
          </section>

          <section>
            <div className="cal-sync__head">
              <h4>
                <CalendarDays /> Импортированные события
              </h4>
              {external.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setClearOpen(true)}>
                  <Trash2 /> Очистить
                </button>
              )}
            </div>
            {external.length === 0 ? (
              <span className="cal-sync__empty">Пока ничего не импортировано</span>
            ) : (
              <ul className="cal-sync__list">
                {external.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <b>{item.title}</b>
                    <span>
                      {item.localDate}
                      {item.allDay ? ' · весь день' : ` · ${new Date(item.startsAt.replace(' ', 'T')).toISOString().slice(11, 16)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={clearOpen}
        title="Удалить импортированные события?"
        message="Личные события исчезнут из календаря, и это время снова станет доступным для записи."
        confirmLabel="Удалить события"
        busy={clearing}
        icon={<Trash2 />}
        onConfirm={() => void clearExternal()}
        onClose={() => setClearOpen(false)}
      />

      <BookingDrawer
        bookingId={detailId}
        statuses={statuses}
        timezone={branding.timezone}
        currencySymbol={branding.currencySymbol}
        decimalSeparator={branding.decimalSeparator}
        onClose={() => setDetailId(null)}
        onChanged={() => void load(true)}
        onDeleted={() => {
          setDetailId(null);
          void load(true);
        }}
      />

      <QuickBookingModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          void load(true);
        }}
      />
    </div>
  );
}
