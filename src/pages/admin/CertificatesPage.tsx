import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Copy,
  Gift,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  TriangleAlert,
  Wallet,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CertificateCard } from '../../components/marketing/CertificateCard';
import { CertificateModal } from '../../components/marketing/CertificateModal';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api, ApiError } from '../../lib/api';
import { formatMoney, plural } from '../../lib/utils';
import type { CertificateItem, CertificateListPayload } from '../../types';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активные' },
  { id: 'used', label: 'Использованные' },
  { id: 'expired', label: 'Истёкшие' }
] as const;

const STATUS_LABEL: Record<CertificateItem['status'], string> = {
  active: 'активен',
  used: 'использован',
  expired: 'истёк',
  blocked: 'заблокирован'
};

function formatDay(value: string | null): string {
  if (!value) return 'без срока';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

export function CertificatesPage() {
  const { subscribe } = useRealtime();
  const { toast } = useToast();
  const { branding } = useSettings();

  const [data, setData] = useState<CertificateListPayload | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CertificateItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CertificateItem | null>(null);
  const [removing, setRemoving] = useState<CertificateItem | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ status: filter });
        if (query.trim()) params.set('q', query.trim());
        const payload = await api.get<CertificateListPayload>(`/marketing/certificates?${params.toString()}`);
        setData(payload);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить сертификаты');
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
      if (editing) await api.patch(`/marketing/certificates/${editing.id}`, payload);
      else await api.post('/marketing/certificates', payload);
      setEditorOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Сертификат обновлён' : 'Сертификат выпущен', variant: 'success' });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить сертификат');
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async (item: CertificateItem) => {
    setBusyId(item.id);
    try {
      await api.patch(`/marketing/certificates/${item.id}`, {
        status: item.status === 'blocked' ? 'active' : 'blocked'
      });
      toast({
        title: item.status === 'blocked' ? 'Сертификат разблокирован' : 'Сертификат заблокирован',
        subtitle: item.code,
        variant: 'success'
      });
      await load(true);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Не удалось изменить', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await api.del(`/marketing/certificates/${removing.id}`);
      toast({ title: 'Сертификат удалён', subtitle: removing.code, variant: 'success' });
      setRemoving(null);
      setDetail(null);
      await load(true);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Не удалось удалить', variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const counts = data?.counts;
  const stats = useMemo(
    () => [
      {
        id: 'active',
        label: 'Активных сертификатов',
        value: String(counts?.active ?? 0),
        hint: `${counts?.used ?? 0} ${plural(counts?.used ?? 0, 'использован', 'использовано', 'использовано')}`,
        icon: <BadgeCheck />
      },
      {
        id: 'balance',
        label: 'Неиспользованный номинал',
        value: formatMoney(counts?.balance ?? 0, branding.currencySymbol, branding.decimalSeparator),
        hint: 'числится за клиентами',
        icon: <Wallet />
      },
      {
        id: 'all',
        label: 'Всего выпущено',
        value: String(counts?.all ?? 0),
        hint: `${counts?.expired ?? 0} ${plural(counts?.expired ?? 0, 'истёк', 'истекли', 'истекли')}`,
        icon: <Gift />
      }
    ],
    [counts, branding]
  );

  return (
    <div className="page marketing-page">
      <PageHead
        title="Сертификаты"
        subtitle="Подарочные сертификаты с номиналом или на конкретную услугу"
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
              <Plus /> <span>Выпустить</span>
            </button>
          </>
        }
      />

      <div className="mk-stats mk-stats--three">
        {stats.map((stat, index) => (
          <div className="mk-stat" key={stat.id} style={{ animationDelay: `${index * 60}ms` }}>
            <span className="mk-stat__icon">{stat.icon}</span>
            <div>
              <em>{stat.label}</em>
              <b className="tnum">{stat.value}</b>
              <span>{stat.hint}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card mk-toolbar">
        <div className="mk-filters" role="tablist" aria-label="Фильтр сертификатов">
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
            placeholder="Код, имя, телефон"
            aria-label="Поиск сертификатов"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => setQuery('')}>
              <X />
            </button>
          )}
        </label>
      </div>

      <div className="mk-hint">
        <Ticket />
        <span>Нажмите на сертификат, чтобы увидеть детали и историю списаний с обратной стороны.</span>
      </div>

      {error && !loading && (
        <div className="bookings-error">
          <TriangleAlert />
          <div>
            <b>Не удалось загрузить сертификаты</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="cert-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <span className="skeleton cert-skeleton" key={index} />
          ))}
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="bookings-empty">
          <span className="bookings-empty__icon">
            <Gift />
          </span>
          <b>{query ? 'Ничего не найдено' : 'Сертификатов пока нет'}</b>
          <span>
            {query
              ? 'Проверьте код или имя получателя.'
              : 'Выпустите первый — например, на 8 000 ₽ или на конкретную услугу. Клиент вводит код при записи.'}
          </span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="cert-grid">
          {data.items.map((item) => (
            <CertificateCard
              key={item.id}
              item={item}
              currencySymbol={branding.currencySymbol}
              decimalSeparator={branding.decimalSeparator}
              onToggleBlock={() => void toggleBlock(item)}
              onOpen={() => setDetail(item)}
            />
          ))}
        </div>
      )}

      <CertificateModal
        open={editorOpen}
        certificate={editing}
        saving={saving}
        error={formError}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSubmit={(payload) => void submit(payload)}
      />

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? detail.code : 'Сертификат'}
        subtitle={detail ? STATUS_LABEL[detail.status] : undefined}
        icon={<Gift />}
        size="medium"
        footer={
          detail ? (
            <div className="cert-detail__foot">
              <button
                type="button"
                className="btn btn--ghost cert-actions__delete"
                onClick={() => setRemoving(detail)}
                disabled={detail.status === 'used'}
                title={detail.status === 'used' ? 'Использованный сертификат удалить нельзя' : 'Удалить'}
              >
                <Trash2 /> Удалить
              </button>
              <div className="spacer" />
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(detail.code);
                    setCopied(detail.code);
                    setTimeout(() => setCopied(null), 1600);
                  } catch {
                    /* копирование недоступно */
                  }
                }}
              >
                {copied === detail.code ? <Check /> : <Copy />} Код
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setEditing(detail);
                  setFormError(null);
                  setEditorOpen(true);
                  setDetail(null);
                }}
              >
                Изменить
              </button>
            </div>
          ) : null
        }
      >
        {detail && (
          <div className="cert-detail">
            <div className="cert-detail__value">
              <span>Номинал</span>
              <b className="tnum">{formatMoney(detail.amount, branding.currencySymbol, branding.decimalSeparator)}</b>
              <em>
                остаток {formatMoney(detail.remaining, branding.currencySymbol, branding.decimalSeparator)}
              </em>
            </div>

            <div className="cert-detail__rows">
              <div>
                <span>Получатель</span>
                <b>{detail.recipient || '—'}</b>
              </div>
              <div>
                <span>Телефон</span>
                <b>{detail.phone || '—'}</b>
              </div>
              <div>
                <span>Почта</span>
                <b>{detail.email || '—'}</b>
              </div>
              <div>
                <span>Услуга</span>
                <b>{detail.serviceName || 'На любую услугу'}</b>
              </div>
              <div>
                <span>Выпущен</span>
                <b>{formatDay(detail.purchasedAt)}</b>
              </div>
              <div>
                <span>Действует до</span>
                <b>{formatDay(detail.expiresAt)}</b>
              </div>
            </div>

            {detail.note && <p className="cert-detail__note">{detail.note}</p>}

            <div className="cert-detail__history">
              <h4>
                <CalendarClock /> История списаний
              </h4>
              {detail.history.length === 0 ? (
                <p className="bd-empty-note">Сертификат ещё не использовался.</p>
              ) : (
                <ul>
                  {detail.history.map((row) => (
                    <li key={row.id}>
                      <Wallet />
                      <b className="tnum">{formatMoney(row.amount, branding.currencySymbol, branding.decimalSeparator)}</b>
                      <span>{row.startsAt ? formatDay(row.startsAt.slice(0, 10)) : formatDay(row.createdAt?.slice(0, 10) || null)}</span>
                      {row.code && <em>#{row.code}</em>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        title="Удалить сертификат?"
        message={<span>Сертификат {removing?.code} перестанет приниматься при записи.</span>}
        confirmLabel="Удалить сертификат"
        icon={<Trash2 />}
        busy={busyId === removing?.id}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
