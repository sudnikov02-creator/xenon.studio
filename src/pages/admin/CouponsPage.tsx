import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Copy,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Switch } from '../../components/ui/Switch';
import { CouponModal } from '../../components/marketing/CouponModal';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api, ApiError } from '../../lib/api';
import { formatMoney, plural } from '../../lib/utils';
import type { CouponItem, CouponListPayload, DiscountItem, DiscountListPayload } from '../../types';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Действуют' },
  { id: 'used', label: 'Использованные' },
  { id: 'off', label: 'Выключенные' }
] as const;

const STATUS_LABEL: Record<CouponItem['status'], string> = {
  active: 'действует',
  off: 'выключен',
  expired: 'истёк',
  exhausted: 'лимит исчерпан',
  scheduled: 'запланирован'
};

function dateLabel(item: CouponItem): string {
  if (!item.startsOn && !item.endsOn) return 'без срока';
  const format = (value: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00.000Z`));
  if (item.startsOn && item.endsOn) return `${format(item.startsOn)} — ${format(item.endsOn)}`;
  if (item.endsOn) return `до ${format(item.endsOn)}`;
  return `с ${format(item.startsOn as string)}`;
}

export function CouponsPage() {
  const { subscribe } = useRealtime();
  const { toast } = useToast();
  const { branding } = useSettings();

  const [data, setData] = useState<CouponListPayload | null>(null);
  const [discounts, setDiscounts] = useState<DiscountItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CouponItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CouponItem | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ status: filter });
        if (query.trim()) params.set('q', query.trim());
        const [coupons, discountData] = await Promise.all([
          api.get<CouponListPayload>(`/marketing/coupons?${params.toString()}`),
          api.get<DiscountListPayload>('/marketing/discounts')
        ]);
        setData(coupons);
        setDiscounts(discountData.items);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить промокоды');
      } finally {
        setLoading(false);
      }
    },
    [filter, query]
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribe('marketing', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(true), 250);
    });
    return () => {
      if (timer) clearTimeout(timer);
      off();
    };
  }, [subscribe, load]);

  const submit = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.patch(`/marketing/coupons/${editing.id}`, payload);
      else await api.post('/marketing/coupons', payload);
      setEditorOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Промокод обновлён' : 'Промокод создан', variant: 'success' });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить промокод');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast({ title: 'Не удалось скопировать', subtitle: code, variant: 'error' });
    }
  };

  const toggle = async (item: CouponItem, value: boolean) => {
    setBusyId(item.id);
    try {
      await api.patch(`/marketing/coupons/${item.id}`, { isActive: value });
      await load(true);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Не удалось изменить промокод', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await api.del(`/marketing/coupons/${removing.id}`);
      toast({ title: 'Промокод удалён', subtitle: removing.code, variant: 'success' });
      setRemoving(null);
      await load(true);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Не удалось удалить', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const counts = data?.counts;
  const subtitle = useMemo(() => {
    if (!counts) return 'Персональные и кампанийные коды со скидкой';
    return `${counts.all} ${plural(counts.all, 'промокод', 'промокода', 'промокодов')} · ${counts.active} ${
      plural(counts.active, 'действует', 'действуют', 'действуют')
    } · ${counts.used} ${plural(counts.used, 'использован', 'использованы', 'использованы')}`;
  }, [counts]);

  return (
    <div className="page marketing-page">
      <PageHead
        title="Промокоды"
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
              <RefreshCw />
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEditing(null);
                setFormError(null);
                setEditorOpen(true);
              }}
            >
              <Plus /> <span>Новый промокод</span>
            </button>
          </>
        }
      />

      <div className="card mk-toolbar">
        <div className="mk-filters" role="tablist" aria-label="Фильтр промокодов">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className="mk-filter"
              data-active={filter === item.id || undefined}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="input-wrap mk-search">
          <Search aria-hidden />
          <input
            className="input"
            type="search"
            value={query}
            placeholder="Код или кампания"
            aria-label="Поиск промокодов"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => setQuery('')}>
              <X />
            </button>
          )}
        </label>
      </div>

      {error && !loading && (
        <div className="bookings-error">
          <TriangleAlert />
          <div>
            <b>Не удалось загрузить промокоды</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="coupon-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <span className="skeleton coupon-skeleton" key={index} />
          ))}
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="bookings-empty">
          <span className="bookings-empty__icon">
            <Ticket />
          </span>
          <b>{query ? 'Ничего не найдено' : 'Промокодов пока нет'}</b>
          <span>
            {query
              ? 'Проверьте код или название кампании.'
              : 'Создайте код для рассылки: скидка применится сама, когда клиент введёт его на форме записи.'}
          </span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="coupon-list">
          {data.items.map((item) => {
            const usage = item.limitTotal > 0 ? Math.min((item.usedCount / item.limitTotal) * 100, 100) : 0;
            return (
              <article className="coupon" key={item.id} data-status={item.status} data-off={!item.isActive || undefined}>
                <div className="coupon__code">
                  <button
                    type="button"
                    className="coupon__code-btn"
                    onClick={() => void copy(item.code)}
                    title="Скопировать код"
                  >
                    <Ticket />
                    <b>{item.code}</b>
                    {copied === item.code ? <Check /> : <Copy />}
                  </button>
                  <span className="coupon__status" data-status={item.status}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="coupon__main">
                  <b>{item.title || (item.discountName ? `Скидка «${item.discountName}»` : 'Промокод')}</b>
                  <span className="coupon__value tnum">
                    <Percent />
                    {item.kind === 'percent'
                      ? `${item.value}%`
                      : formatMoney(item.value, branding.currencySymbol, branding.decimalSeparator)}
                    {item.minAmount > 0 && (
                      <em>
                        от {formatMoney(item.minAmount, branding.currencySymbol, branding.decimalSeparator)}
                      </em>
                    )}
                  </span>
                  <span className="coupon__meta">
                    <CalendarClock /> {dateLabel(item)}
                    {item.limitPerClient > 1 && <em>· {item.limitPerClient} раза одному клиенту</em>}
                  </span>
                </div>

                <div className="coupon__usage">
                  <div className="coupon__bar">
                    <i style={{ width: `${usage}%` }} />
                  </div>
                  <span>
                    <b className="tnum">{item.usedCount}</b>
                    {item.limitTotal > 0 ? ` / ${item.limitTotal}` : ' использований'}
                  </span>
                  {item.saved > 0 && (
                    <em>сэкономлено {formatMoney(item.saved, branding.currencySymbol, branding.decimalSeparator)}</em>
                  )}
                </div>

                <div className="coupon__actions">
                  <Switch
                    checked={item.isActive}
                    label={`Промокод ${item.code}`}
                    disabled={busyId === item.id}
                    onChange={(value) => void toggle(item, value)}
                  />
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost"
                    aria-label={`Изменить ${item.code}`}
                    onClick={() => {
                      setEditing(item);
                      setFormError(null);
                      setEditorOpen(true);
                    }}
                  >
                    <Percent />
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon btn--ghost coupon__delete"
                    aria-label={`Удалить ${item.code}`}
                    onClick={() => setRemoving(item)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CouponModal
        open={editorOpen}
        coupon={editing}
        discounts={discounts}
        saving={saving}
        error={formError}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSubmit={(payload) => void submit(payload)}
      />

      <ConfirmModal
        open={Boolean(removing)}
        title="Удалить промокод?"
        message={<span>Код {removing?.code} перестанет приниматься на форме записи.</span>}
        confirmLabel="Удалить промокод"
        icon={<Trash2 />}
        busy={busyId === removing?.id}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
