import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  CircleUser,
  GalleryVerticalEnd,
  History,
  MessageSquare,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Star,
  StickyNote,
  TriangleAlert,
  UserPlus,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { useToast } from '../../context/ToastContext';
import { useRealtime } from '../../context/RealtimeContext';
import { api, ApiError } from '../../lib/api';
import { formatDate, plural } from '../../lib/utils';
import type { ActivityItem, ActivityPayload } from '../../types';

type IconType = typeof History;

const TYPE_ICONS: Record<string, IconType> = {
  booking: CalendarCheck,
  status: History,
  client: UserPlus,
  message: MessageSquare,
  marketing: Percent,
  discount: Percent,
  gallery: GalleryVerticalEnd,
  review: Star,
  settings: Settings2
};

const ACTOR_LABELS: Record<string, string> = {
  photographer: 'вы',
  client: 'клиент',
  system: 'система'
};

function actorLabel(actor: string): string {
  return ACTOR_LABELS[actor] || actor;
}

function dayTitle(item: ActivityItem): string {
  if (item.isToday) return 'Сегодня';
  const date = new Date(`${item.day}T00:00:00.000Z`);
  return formatDate(date, { day: 'numeric', month: 'long', weekday: 'long' });
}

export function ActivityPage() {
  const { toast } = useToast();
  const { subscribe } = useRealtime();

  const [type, setType] = useState('all');
  const [actor, setActor] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 320);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [type, actor, search]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(targetPage), limit: '30' });
        if (type !== 'all') params.set('type', type);
        if (actor !== 'all') params.set('actor', actor);
        if (search) params.set('q', search);
        const payload = await api.get<ActivityPayload>(`/activity?${params.toString()}`);
        setData((prev) =>
          append && prev
            ? { ...payload, items: [...prev.items, ...payload.items.filter((item) => !prev.items.some((old) => old.id === item.id))] }
            : payload
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [type, actor, search]
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  useEffect(() => {
    const off = subscribe('activity', () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(1, false), 400);
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      off();
    };
  }, [subscribe, load]);

  const submitNote = async () => {
    if (note.trim().length < 2) {
      toast({ title: 'Слишком коротко', subtitle: 'Опишите событие хотя бы двумя символами', variant: 'error' });
      return;
    }
    setNoteSaving(true);
    try {
      await api.post('/activity', { title: note.trim() });
      setNote('');
      toast({ title: 'Заметка добавлена', subtitle: 'Она появится в начале журнала', variant: 'success' });
      await load(1, false);
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setNoteSaving(false);
    }
  };

  const groups = (() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of data?.items || []) {
      const list = map.get(item.day) || [];
      list.push(item);
      map.set(item.day, list);
    }
    return Array.from(map.entries());
  })();

  const filtered = Boolean(search) || type !== 'all' || actor !== 'all';

  return (
    <div className="page act-page">
      <PageHead
        title="Журнал действий"
        subtitle={
          data
            ? `${data.counts.all} ${plural(data.counts.all, 'событие', 'события', 'событий')} всего · ${data.counts.today} сегодня`
            : 'Загрузка событий'
        }
        actions={
          <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load(1, false)} aria-label="Обновить">
            <RefreshCw />
          </button>
        }
      />

      <div className="card act-note">
        <span className="act-note__icon">
          <StickyNote />
        </span>
        <input
          className="input"
          value={note}
          placeholder="Заметка: звонок клиенту, идея съёмки, напоминание…"
          aria-label="Новая заметка"
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitNote();
          }}
        />
        <button type="button" className="btn btn--primary" disabled={noteSaving} onClick={() => void submitNote()}>
          <Plus /> <span>Добавить</span>
        </button>
      </div>

      <div className="act-filters">
        <div className="act-chips" role="tablist" aria-label="Тип события">
          <button
            type="button"
            role="tab"
            aria-selected={type === 'all'}
            className="act-chip"
            data-active={type === 'all' || undefined}
            onClick={() => setType('all')}
          >
            Все
            <b className="tnum">{data?.counts.all ?? 0}</b>
          </button>
          {(data?.types || [])
            .filter((item) => item.count > 0)
            .map((item) => {
              const Icon = TYPE_ICONS[item.id] || History;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={type === item.id}
                  className="act-chip"
                  data-active={type === item.id || undefined}
                  onClick={() => setType(item.id)}
                >
                  <Icon />
                  {item.label}
                  <b className="tnum">{item.count}</b>
                </button>
              );
            })}
        </div>

        <div className="act-tools">
          <div className="act-search">
            <Search />
            <input
              className="input"
              value={query}
              placeholder="Поиск по событиям"
              aria-label="Поиск по журналу"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button type="button" className="act-search__clear" onClick={() => setQuery('')} aria-label="Очистить поиск">
                <X />
              </button>
            )}
          </div>

          <div className="act-actors">
            <button
              type="button"
              className="act-actor"
              data-active={actor === 'all' || undefined}
              onClick={() => setActor('all')}
            >
              Все авторы
            </button>
            {(data?.actors || []).map((item) => (
              <button
                key={item.id}
                type="button"
                className="act-actor"
                data-active={actor === item.id || undefined}
                onClick={() => setActor(item.id)}
              >
                {item.label}
                <b className="tnum">{item.count}</b>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && !loading && (
        <div className="cal-error" role="alert">
          <TriangleAlert /> <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="act-list">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="skeleton act-skeleton" key={index} />
          ))}
        </div>
      )}

      {data && groups.length === 0 && (
        <div className="card act-empty">
          <History />
          <b>{filtered ? 'Ничего не найдено' : 'Журнал пока пуст'}</b>
          <span>
            {filtered
              ? 'Попробуйте другой тип события, автора или запрос.'
              : 'События появляются здесь автоматически: заявки, сообщения, скидки, отзывы.'}
          </span>
          {filtered && (
            <button
              type="button"
              className="btn btn--bordered"
              onClick={() => {
                setType('all');
                setActor('all');
                setQuery('');
              }}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {data && groups.length > 0 && (
        <div className="act-list">
          {groups.map(([day, items]) => (
            <section className="act-group" key={day}>
              <header className="act-group__head">
                <span>{dayTitle(items[0])}</span>
                <em>
                  {items.length} {plural(items.length, 'событие', 'события', 'событий')}
                </em>
              </header>
              <ul className="act-items">
                {items.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || History;
                  return (
                    <li className="act-item" key={item.id} data-type={item.type}>
                      <span className="act-item__icon" data-tone={item.type}>
                        <Icon />
                      </span>
                      <div className="act-item__body">
                        <b>{item.title}</b>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <div className="act-item__meta">
                        <span className="act-badge" data-actor={item.actor}>
                          {item.actor === 'client' ? <CircleUser /> : null}
                          {actorLabel(item.actor)}
                        </span>
                        <time className="tnum">
                          {new Date(item.createdAt.replace(' ', 'T')).toISOString().slice(11, 16)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {data.hasMore && (
            <button
              type="button"
              className="btn btn--bordered act-more"
              disabled={loadingMore}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void load(next, true);
              }}
            >
              {loadingMore ? 'Загружаем…' : 'Показать ещё'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
