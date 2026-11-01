import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgePercent,
  Gift,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  Ticket,
  TriangleAlert,
  Wallet
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Switch } from '../../components/ui/Switch';
import { DiscountCard } from '../../components/marketing/DiscountCard';
import { DiscountModal } from '../../components/marketing/DiscountModal';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api, ApiError } from '../../lib/api';
import { formatMoney, plural } from '../../lib/utils';
import type { DiscountItem, DiscountListPayload, MarketingOverview } from '../../types';

export function DiscountsPage() {
  const { subscribe } = useRealtime();
  const { toast } = useToast();
  const { branding } = useSettings();
  const navigate = useNavigate();

  const [data, setData] = useState<DiscountListPayload | null>(null);
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [discounts, summary] = await Promise.all([
        api.get<DiscountListPayload>('/marketing/discounts'),
        api.get<MarketingOverview>('/marketing/overview')
      ]);
      setData(discounts);
      setOverview(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить скидки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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

  const toggle = async (item: DiscountItem, value: boolean) => {
    setBusyId(item.id);
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((row) => (row.id === item.id ? { ...row, isActive: value } : row)) } : prev
    );
    try {
      await api.patch(`/marketing/discounts/${item.id}`, { isActive: value });
      await load(true);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Не удалось изменить скидку', variant: 'error' });
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.patch(`/marketing/discounts/${editing.id}`, payload);
      else await api.post('/marketing/discounts', payload);
      setEditorOpen(false);
      setEditing(null);
      toast({ title: editing ? 'Скидка обновлена' : 'Скидка создана', variant: 'success' });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить скидку');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: DiscountItem) => {
    setBusyId(item.id);
    try {
      await api.del(`/marketing/discounts/${item.id}`);
      toast({ title: 'Скидка удалена', subtitle: item.name, variant: 'success' });
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
        label: 'Активных скидок',
        value: String(counts?.active ?? 0),
        hint: `${counts?.off ?? 0} ${plural(counts?.off ?? 0, 'выключена', 'выключены', 'выключено')}`,
        icon: <BadgePercent />
      },
      {
        id: 'saved',
        label: 'Сэкономлено клиентам',
        value: formatMoney(overview?.saved ?? 0, branding.currencySymbol, branding.decimalSeparator),
        hint: 'за текущий месяц',
        icon: <Wallet />
      },
      {
        id: 'coupons',
        label: 'Промокодов',
        value: String(overview?.coupons.active ?? 0),
        hint: `${overview?.coupons.used ?? 0} уже использовались`,
        icon: <Ticket />
      },
      {
        id: 'certificates',
        label: 'Сертификатов в обороте',
        value: formatMoney(overview?.certificates.balance ?? 0, branding.currencySymbol, branding.decimalSeparator),
        hint: `${overview?.certificates.active ?? 0} активных`,
        icon: <Gift />
      }
    ],
    [counts, overview, branding]
  );

  return (
    <div className="page marketing-page">
      <PageHead
        title="Скидки"
        subtitle="Автоматические скидки: применяются сами, когда клиент подходит по условиям"
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
              <Plus /> <span>Новая скидка</span>
            </button>
          </>
        }
      />

      <div className="mk-stats">
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

      <div className="mk-hint">
        <Sparkles />
        <span>
          Скидка применяется сама на форме записи, если подходит услуга, сумма и клиент. Если скидок несколько —
          клиент получит самую выгодную.
        </span>
      </div>

      {error && !loading && (
        <div className="bookings-error">
          <TriangleAlert />
          <div>
            <b>Не удалось загрузить скидки</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="mk-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <span className="skeleton mk-skeleton" key={index} />
          ))}
        </div>
      )}

      {!loading && data && data.items.length === 0 && (
        <div className="bookings-empty">
          <span className="bookings-empty__icon">
            <Percent />
          </span>
          <b>Скидок пока нет</b>
          <span>Создайте первую — например, 10% новым клиентам или фиксированную сумму на семейную съёмку.</span>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus /> Создать скидку
          </button>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mk-grid">
          {data.items.map((item) => (
            <DiscountCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              currencySymbol={branding.currencySymbol}
              decimalSeparator={branding.decimalSeparator}
              onToggle={(value) => void toggle(item, value)}
              onEdit={() => {
                setEditing(item);
                setFormError(null);
                setEditorOpen(true);
              }}
              onDelete={() => void remove(item)}
              onCoupons={() => navigate('/admin/marketing/coupons')}
            />
          ))}
        </div>
      )}

      <DiscountModal
        open={editorOpen}
        discount={editing}
        saving={saving}
        error={formError}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSubmit={(payload) => void submit(payload)}
      />
    </div>
  );
}
