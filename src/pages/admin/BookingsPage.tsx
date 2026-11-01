import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownUp,
  CalendarDays,
  CalendarPlus,
  Check,
  ListFilter,
  RefreshCw,
  Search,
  TriangleAlert,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import { BookingRow } from '../../components/bookings/BookingRow';
import { BookingDrawer } from '../../components/bookings/BookingDrawer';
import { useSettings } from '../../context/SettingsContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { plural } from '../../lib/utils';
import type { BookingListPayload, BookingPeriod, BookingStatusesPayload, BookingSummary } from '../../types';

type SortKey = 'date' | 'created' | 'price';

const PERIODS: { id: BookingPeriod; label: string }[] = [
  { id: 'all', label: 'Всё время' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Эта неделя' },
  { id: 'month', label: 'Этот месяц' },
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'past', label: 'Прошедшие' }
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'date', label: 'По дате съёмки' },
  { id: 'created', label: 'По дате заявки' },
  { id: 'price', label: 'По стоимости' }
];

const LIMIT = 20;

export function BookingsPage() {
  const { branding } = useSettings();
  const { subscribe } = useRealtime();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<BookingStatusesPayload | null>(null);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState<BookingPeriod>('all');
  const [sort, setSort] = useState<SortKey>('date');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const [items, setItems] = useState<BookingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);

  const seq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const queryString = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams();
      params.set('status', status);
      params.set('period', period);
      params.set('sort', sort);
      params.set('page', String(targetPage));
      params.set('limit', String(LIMIT));
      if (debounced) params.set('q', debounced);
      if (status === 'all') params.set('includeCancelled', '1');
      return params.toString();
    },
    [status, period, sort, debounced]
  );

  const loadStatuses = useCallback(async () => {
    try {
      const data = await api.get<BookingStatusesPayload>('/bookings/statuses');
      setStatuses(data);
    } catch {
      /* счётчики не критичны */
    }
  }, []);

  const load = useCallback(
    async (targetPage = 1) => {
      const id = ++seq.current;
      const append = targetPage > 1;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const data = await api.get<BookingListPayload>(`/bookings?${queryString(targetPage)}`);
        if (id !== seq.current) return;
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(data.page);
        setError(null);
      } catch (err) {
        if (id !== seq.current) return;
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить записи');
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [queryString]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribe('booking', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void load(1);
        void loadStatuses();
      }, 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      off();
    };
  }, [subscribe, load, loadStatuses]);

  const tabs = useMemo<TabItem[]>(() => {
    const all: TabItem = {
      id: 'all',
      label: 'Все',
      count: statuses?.total ?? undefined
    };
    const rest = (statuses?.statuses || []).map<TabItem>((item) => ({
      id: `status:${item.id}`,
      label: item.name,
      count: item.count
    }));
    return [all, ...rest];
  }, [statuses]);

  const activeFilters = (period !== 'all' ? 1 : 0) + (debounced ? 1 : 0);

  const { timezone, currencySymbol, decimalSeparator } = branding;
  const today = statuses?.today || '';

  const openBooking = (booking: BookingSummary) => setOpenId(booking.id);

  const refreshAfterChange = () => {
    void load(1);
    void loadStatuses();
  };

  return (
    <div className="page bookings-page">
      <PageHead
        title="Записи"
        subtitle={
          statuses
            ? `${statuses.total} ${plural(statuses.total, 'запись', 'записи', 'записей')} · сегодня ${statuses.todayCount}`
            : 'Все заявки и съёмки студии в одном списке'
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn--icon btn--bordered"
              onClick={() => {
                void load(1);
                void loadStatuses();
              }}
              aria-label="Обновить список"
            >
              <RefreshCw />
            </button>
            <Link to="/booking" className="btn btn--primary">
              <CalendarPlus /> <span>Новая запись</span>
            </Link>
          </>
        }
      />

      <div className="card bookings-card">
        <Tabs
          items={tabs}
          value={status}
          onChange={(id) => {
            setStatus(id);
            setItems([]);
          }}
          className="bookings-tabs"
        />

        <div className="bookings-toolbar">
          <label className="input-wrap bookings-search">
            <Search aria-hidden />
            <input
              className="input"
              type="search"
              value={query}
              placeholder="Имя, телефон, услуга, код"
              aria-label="Поиск записей"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => setQuery('')}>
                <X />
              </button>
            )}
          </label>

          <button
            type="button"
            className="btn btn--bordered bookings-filter-toggle"
            data-active={activeFilters > 0 || undefined}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <ListFilter /> Фильтры
            {activeFilters > 0 && <b className="bookings-filter-dot">{activeFilters}</b>}
          </button>

          <div className="bookings-selects" data-open={filtersOpen || undefined}>
            <select
              className="select bookings-select"
              value={period}
              aria-label="Период"
              onChange={(event) => setPeriod(event.target.value as BookingPeriod)}
            >
              {PERIODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              className="select bookings-select"
              value={sort}
              aria-label="Сортировка"
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              {SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {debounced && (
          <div className="bookings-active-filter">
            <span>
              Поиск: <b>{debounced}</b>
            </span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setQuery('')}>
              Сбросить
            </button>
          </div>
        )}

        {error && !loading && (
          <div className="bookings-error">
            <TriangleAlert />
            <div>
              <b>Не удалось загрузить записи</b>
              <span>{error}</span>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => void load(1)}>
              Повторить
            </button>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="bookings-list">
            {Array.from({ length: 6 }).map((_, index) => (
              <span className="skeleton bookings-skeleton" key={index} />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bookings-empty">
            <span className="bookings-empty__icon">
              <CalendarDays />
            </span>
            <b>Записей нет</b>
            <span>
              {debounced || activeFilters > 0
                ? 'Попробуйте изменить фильтры или поисковый запрос.'
                : 'Как только клиент оставит заявку, она появится здесь автоматически.'}
            </span>
            {(debounced || activeFilters > 0) && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setQuery('');
                  setPeriod('all');
                  setStatus('all');
                }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="brow-head" aria-hidden>
              <span>Когда</span>
              <span />
              <span>Клиент и услуга</span>
              <span>Статус</span>
              <span className="brow-head__price">Стоимость</span>
              <span />
            </div>
            <div className="bookings-list" data-loading={loading || undefined}>
              {items.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  timezone={timezone}
                  currencySymbol={currencySymbol}
                  decimalSeparator={decimalSeparator}
                  today={today}
                  onOpen={openBooking}
                />
              ))}
            </div>
          </>
        )}

        {items.length > 0 && (
          <div className="bookings-foot">
            <span>
              Показано {items.length} из {total}
            </span>
            {hasMore ? (
              <button
                type="button"
                className={`btn btn--bordered${loadingMore ? ' btn--loading' : ''}`}
                onClick={() => void load(page + 1)}
                disabled={loadingMore}
              >
                Показать ещё
              </button>
            ) : (
              <span className="bookings-foot__done">
                <Check /> Это все записи
              </span>
            )}
          </div>
        )}
      </div>

      <BookingDrawer
        bookingId={openId}
        statuses={statuses?.statuses || []}
        timezone={timezone}
        currencySymbol={currencySymbol}
        decimalSeparator={decimalSeparator}
        onClose={() => setOpenId(null)}
        onChanged={refreshAfterChange}
        onDeleted={() => {
          toast({ title: 'Запись удалена', subtitle: 'Карточка убрана из списка', variant: 'success' });
          refreshAfterChange();
        }}
      />
    </div>
  );
}
