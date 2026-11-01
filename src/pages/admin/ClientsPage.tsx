import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Ban,
  Check,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { ClientRow } from '../../components/clients/ClientRow';
import { ClientDrawer } from '../../components/clients/ClientDrawer';
import { ClientModal } from '../../components/clients/ClientModal';
import { useSettings } from '../../context/SettingsContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { plural, zonedDayKey } from '../../lib/utils';
import type { ClientDetailPayload, ClientDraft, ClientListPayload, ClientSegment, ClientSort } from '../../types';

const SEGMENTS: { id: ClientSegment; label: string; icon?: typeof Users }[] = [
  { id: 'all', label: 'Все', icon: Users },
  { id: 'vip', label: 'VIP', icon: Star },
  { id: 'active', label: 'С записью', icon: Sparkles },
  { id: 'new', label: 'Новые', icon: UserPlus },
  { id: 'sleeping', label: 'Спящие', icon: Moon },
  { id: 'lead', label: 'Без съёмок', icon: UserPlus },
  { id: 'blacklist', label: 'Чёрный список', icon: Ban }
];

const SORTS: { id: ClientSort; label: string }[] = [
  { id: 'recent', label: 'По последнему визиту' },
  { id: 'created', label: 'По дате добавления' },
  { id: 'spent', label: 'По сумме' },
  { id: 'bookings', label: 'По числу съёмок' },
  { id: 'name', label: 'По имени' }
];

const LIMIT = 20;

export function ClientsPage() {
  const { branding } = useSettings();
  const { subscribe } = useRealtime();
  const { toast } = useToast();

  const [segment, setSegment] = useState<ClientSegment>('all');
  const [sort, setSort] = useState<ClientSort>('recent');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const [data, setData] = useState<ClientListPayload | null>(null);
  const [items, setItems] = useState<ClientListPayload['items']>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const seq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const qs = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams();
      params.set('segment', segment);
      params.set('sort', sort);
      params.set('page', String(targetPage));
      params.set('limit', String(LIMIT));
      if (debounced) params.set('q', debounced);
      return params.toString();
    },
    [segment, sort, debounced]
  );

  const load = useCallback(
    async (targetPage = 1) => {
      const id = ++seq.current;
      const append = targetPage > 1;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const next = await api.get<ClientListPayload>(`/clients?${qs(targetPage)}`);
        if (id !== seq.current) return;
        setData(next);
        setItems((prev) => (append ? [...prev, ...next.items] : next.items));
        setHasMore(next.hasMore);
        setPage(next.page);
        setError(null);
      } catch (err) {
        if (id !== seq.current) return;
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить клиентов');
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [qs]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(1), 250);
    };
    const offClient = subscribe('client', refresh);
    const offBooking = subscribe('booking', refresh);
    return () => {
      if (timer) clearTimeout(timer);
      offClient();
      offBooking();
    };
  }, [subscribe, load]);

  const counts = data?.counts;
  const total = data?.total ?? 0;

  const submitCreate = async (draft: ClientDraft) => {
    setCreating(true);
    setCreateError(null);
    try {
      const payload = await api.post<ClientDetailPayload>('/clients', draft);
      setCreateOpen(false);
      toast({ title: 'Клиент добавлен', subtitle: draft.name, variant: 'success' });
      await load(1);
      setOpenId(payload.client.id);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Не удалось добавить клиента');
    } finally {
      setCreating(false);
    }
  };

  const activeSegment = useMemo(() => SEGMENTS.find((item) => item.id === segment) || SEGMENTS[0], [segment]);
  const today = zonedDayKey(new Date(), branding.timezone);

  return (
    <div className="page clients-page">
      <PageHead
        title="Клиенты"
        subtitle={
          counts
            ? `${counts.all} ${plural(counts.all, 'клиент', 'клиента', 'клиентов')} · ${counts.vip} VIP · ${
                counts.active
              } с записью · ${counts.sleeping + counts.lead} без активности`
            : 'База клиентов, история съёмок и заметки'
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn--icon btn--bordered"
              onClick={() => void load(1)}
              aria-label="Обновить список"
            >
              <RefreshCw />
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
              <Plus /> <span>Новый клиент</span>
            </button>
          </>
        }
      />

      <div className="card clients-card">
        <div className="cl-segments" role="tablist" aria-label="Сегменты клиентов">
          {SEGMENTS.map((item) => {
            const Icon = item.icon;
            const count = counts?.[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={segment === item.id}
                className="cl-segment"
                data-active={segment === item.id || undefined}
                data-empty={count === 0 || undefined}
                onClick={() => {
                  setSegment(item.id);
                  setItems([]);
                }}
              >
                {Icon && <Icon />}
                {item.label}
                <b>{count}</b>
              </button>
            );
          })}
        </div>

        <div className="bookings-toolbar clients-toolbar">
          <label className="input-wrap bookings-search">
            <Search aria-hidden />
            <input
              className="input"
              type="search"
              value={query}
              placeholder="Имя, телефон, почта, мессенджер"
              aria-label="Поиск клиентов"
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
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <ArrowDownUp /> Сортировка
          </button>

          <div className="bookings-selects clients-selects" data-open={filtersOpen || undefined}>
            <select
              className="select bookings-select"
              value={sort}
              aria-label="Сортировка"
              onChange={(event) => setSort(event.target.value as ClientSort)}
            >
              {SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && !loading && (
          <div className="bookings-error">
            <TriangleAlert />
            <div>
              <b>Не удалось загрузить клиентов</b>
              <span>{error}</span>
            </div>
            <button type="button" className="btn btn--sm" onClick={() => void load(1)}>
              Повторить
            </button>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="clients-list">
            {Array.from({ length: 6 }).map((_, index) => (
              <span className="skeleton clients-skeleton" key={index} />
            ))}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="bookings-empty">
            <span className="bookings-empty__icon">
              <Users />
            </span>
            <b>
              {segment === 'all' && !debounced ? 'Клиентов пока нет' : `Никого в сегменте «${activeSegment.label}»`}
            </b>
            <span>
              {segment === 'all' && !debounced
                ? 'Клиенты появляются сами после первой записи — или добавьте вручную.'
                : 'Попробуйте другой сегмент или сбросьте поиск.'}
            </span>
            {(segment !== 'all' || debounced) && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setSegment('all');
                  setQuery('');
                }}
              >
                Показать всех
              </button>
            )}
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="crow-head" aria-hidden>
              <span>Клиент</span>
              <span>Съёмки</span>
              <span>Визит</span>
              <span className="crow-head__num">Потрачено</span>
              <span />
            </div>
            <div className="clients-list" data-loading={loading || undefined}>
              {items.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  today={today}
                  currencySymbol={branding.currencySymbol}
                  decimalSeparator={branding.decimalSeparator}
                  onOpen={(item) => setOpenId(item.id)}
                />
              ))}
            </div>
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
                  <Check /> Это все клиенты
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <ClientDrawer
        clientId={openId}
        currencySymbol={branding.currencySymbol}
        decimalSeparator={branding.decimalSeparator}
        onClose={() => setOpenId(null)}
        onChanged={() => void load(1)}
      />

      <ClientModal
        open={createOpen}
        client={null}
        saving={creating}
        error={createError}
        onClose={() => setCreateOpen(false)}
        onSubmit={(draft) => void submitCreate(draft)}
      />
    </div>
  );
}
