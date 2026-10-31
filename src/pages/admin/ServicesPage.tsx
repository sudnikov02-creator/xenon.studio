import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Layers, Plus, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Tabs } from '../../components/ui/Tabs';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ServiceCard } from '../../components/services/ServiceCard';
import { PackageCard } from '../../components/services/PackageCard';
import { ServiceModal } from '../../components/services/ServiceModal';
import { PackageModal } from '../../components/services/PackageModal';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { useRealtime } from '../../context/RealtimeContext';
import { api, ApiError } from '../../lib/api';
import { cn } from '../../lib/utils';
import type {
  PackageDraft,
  Service,
  ServiceDraft,
  ServicePackage,
  ServicesPayload
} from '../../types';

type TabKey = 'services' | 'packages';
type FilterKey = 'all' | 'active' | 'hidden';

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Доступные' },
  { id: 'hidden', label: 'Скрытые' }
];

export function ServicesPage() {
  const { branding } = useSettings();
  const { toast } = useToast();
  const { subscribe } = useRealtime();

  const [tab, setTab] = useState<TabKey>('services');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceModal, setServiceModal] = useState<{ open: boolean; service: Service | null }>({
    open: false,
    service: null
  });
  const [packageModal, setPackageModal] = useState<{ open: boolean; item: ServicePackage | null }>({
    open: false,
    item: null
  });
  const [deleteTarget, setDeleteTarget] = useState<{ kind: TabKey; item: Service | ServicePackage } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currency = branding.currencySymbol;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<ServicesPayload>('/services');
      setServices(data.services);
      setPackages(data.packages);
      setError(null);
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить услуги');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const offService = subscribe('service', () => void load(true));
    const offPackage = subscribe('package', () => void load(true));
    return () => {
      offService();
      offPackage();
    };
  }, [subscribe, load]);

  const apply = (data: Partial<ServicesPayload>) => {
    if (data.services) setServices(data.services);
    if (data.packages) setPackages(data.packages);
  };

  const notifyError = (err: unknown, fallback: string) =>
    toast({
      title: fallback,
      subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
      variant: 'error'
    });

  const openCreate = () => {
    setFormError(null);
    if (tab === 'services') setServiceModal({ open: true, service: null });
    else setPackageModal({ open: true, item: null });
  };

  const submitService = async (draft: ServiceDraft) => {
    setSaving(true);
    setFormError(null);
    try {
      const editing = serviceModal.service;
      const data = editing
        ? await api.patch<ServicesPayload & { service: Service }>(`/services/${editing.id}`, draft)
        : await api.post<ServicesPayload & { service: Service }>('/services', draft);
      apply(data);
      setServiceModal({ open: false, service: null });
      toast({
        title: editing ? 'Услуга обновлена' : 'Услуга создана',
        subtitle: draft.name,
        variant: 'success'
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить услугу');
    } finally {
      setSaving(false);
    }
  };

  const submitPackage = async (draft: PackageDraft) => {
    setSaving(true);
    setFormError(null);
    try {
      const editing = packageModal.item;
      const data = editing
        ? await api.patch<ServicesPayload>(`/packages/${editing.id}`, draft)
        : await api.post<ServicesPayload>('/packages', draft);
      apply(data);
      setPackageModal({ open: false, item: null });
      toast({
        title: editing ? 'Пакет обновлён' : 'Пакет создан',
        subtitle: draft.name,
        variant: 'success'
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить пакет');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (kind: TabKey, item: Service | ServicePackage) => {
    try {
      if (kind === 'services') {
        const service = item as Service;
        const data = await api.patch<ServicesPayload>(`/services/${service.id}`, {
          name: service.name,
          description: service.description,
          price: service.price,
          duration: service.duration,
          buffer: service.buffer,
          addons: service.addons,
          isActive: !service.isActive
        });
        apply(data);
        toast({
          title: service.isActive ? 'Услуга скрыта' : 'Услуга открыта для записи',
          variant: 'info'
        });
      } else {
        const pack = item as ServicePackage;
        const data = await api.patch<ServicesPayload>(`/packages/${pack.id}`, {
          name: pack.name,
          description: pack.description,
          price: pack.price,
          serviceIds: pack.serviceIds,
          addons: pack.addons,
          isActive: !pack.isActive
        });
        apply(data);
        toast({
          title: pack.isActive ? 'Пакет скрыт' : 'Пакет открыт для записи',
          variant: 'info'
        });
      }
    } catch (err) {
      notifyError(err, 'Не удалось изменить видимость');
    }
  };

  const duplicate = async (kind: TabKey, item: Service | ServicePackage) => {
    try {
      const data =
        kind === 'services'
          ? await api.post<ServicesPayload>(`/services/${item.id}/duplicate`)
          : await api.post<ServicesPayload>(`/packages/${item.id}/duplicate`);
      apply(data);
      toast({
        title: 'Создана копия',
        subtitle: 'Она скрыта — проверьте настройки и опубликуйте',
        variant: 'success'
      });
    } catch (err) {
      notifyError(err, 'Не удалось скопировать');
    }
  };

  const move = async (kind: TabKey, item: Service | ServicePackage, direction: -1 | 1) => {
    try {
      const path = kind === 'services' ? `/services/${item.id}/shift` : `/packages/${item.id}/shift`;
      const data = await api.post<ServicesPayload>(path, { direction });
      apply(data);
    } catch (err) {
      notifyError(err, 'Не удалось изменить порядок');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const data =
        deleteTarget.kind === 'services'
          ? await api.del<ServicesPayload>(`/services/${deleteTarget.item.id}`)
          : await api.del<ServicesPayload>(`/packages/${deleteTarget.item.id}`);
      apply(data);
      toast({ title: 'Удалено', subtitle: deleteTarget.item.name, variant: 'info' });
      setDeleteTarget(null);
    } catch (err) {
      notifyError(err, 'Не удалось удалить');
    } finally {
      setDeleting(false);
    }
  };

  const matches = (name: string, description: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return name.toLowerCase().includes(needle) || description.toLowerCase().includes(needle);
  };

  const filteredServices = useMemo(
    () =>
      services.filter(
        (service) =>
          matches(service.name, service.description) &&
          (filter === 'all' || (filter === 'active' ? service.isActive : !service.isActive))
      ),
    [services, filter, query]
  );

  const filteredPackages = useMemo(
    () =>
      packages.filter(
        (item) =>
          matches(item.name, item.description) &&
          (filter === 'all' || (filter === 'active' ? item.isActive : !item.isActive))
      ),
    [packages, filter, query]
  );

  const items = tab === 'services' ? filteredServices : filteredPackages;
  const deleteTargetPackages =
    deleteTarget?.kind === 'services'
      ? packages.filter((item) => item.serviceIds.includes(deleteTarget.item.id))
      : [];
  const totalCount = services.length + packages.length;
  const hiddenCount = [...services, ...packages].filter((item) => !item.isActive).length;

  return (
    <div className="page services-page">
      <PageHead
        title="Услуги и пакеты"
        subtitle="Цены, длительность и опции, которые клиент видит при записи"
        actions={
          <>
            <Link to="/admin/settings/schedule" className="btn">
              <CalendarClock /> Расписание
            </Link>
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Plus /> {tab === 'services' ? 'Новая услуга' : 'Новый пакет'}
            </button>
          </>
        }
      />

      {error && (
        <div className="card form-alert form-alert--page">
          <TriangleAlert />
          <span>{error}</span>
          <button type="button" className="btn btn--sm btn--soft" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}

      <div className="srv-toolbar">
        <Tabs
          variant="pill"
          value={tab}
          onChange={(value) => setTab(value as TabKey)}
          items={[
            { id: 'services', label: 'Услуги', count: services.length, icon: Sparkles },
            { id: 'packages', label: 'Пакеты', count: packages.length, icon: Layers }
          ]}
        />

        <div className="srv-toolbar__right">
          <label className="input-wrap srv-search">
            <Search />
            <input
              className="input"
              value={query}
              placeholder="Поиск по названию"
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск услуг и пакетов"
            />
          </label>
          <div className="srv-filters" role="group" aria-label="Фильтр по видимости">
            {FILTERS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={cn('srv-filter', filter === item.id && 'is-active')}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="srv-summary">
        <span>
          Всего позиций: <b>{totalCount}</b>
        </span>
        <span className="srv-summary__dot" aria-hidden />
        <span>
          Доступно клиентам: <b>{services.filter((s) => s.isActive).length + packages.filter((p) => p.isActive).length}</b>
        </span>
        {hiddenCount > 0 && (
          <>
            <span className="srv-summary__dot" aria-hidden />
            <span>
              Скрыто: <b>{hiddenCount}</b>
            </span>
          </>
        )}
      </div>

      {loading ? (
        <div className="srv-grid">
          {[0, 1, 2, 3].map((index) => (
            <div className="srv-card card" key={index}>
              <span className="skeleton" style={{ width: '55%', height: 20 }} />
              <span className="skeleton" style={{ width: '100%', height: 12, marginTop: 14 }} />
              <span className="skeleton" style={{ width: '80%', height: 12, marginTop: 8 }} />
              <span className="skeleton" style={{ width: '100%', height: 54, marginTop: 18, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card srv-empty">
          <span className="srv-empty__icon">{tab === 'services' ? <Sparkles /> : <Layers />}</span>
          <b>{query || filter !== 'all' ? 'Ничего не найдено' : tab === 'services' ? 'Услуг пока нет' : 'Пакетов пока нет'}</b>
          <p>
            {query || filter !== 'all'
              ? 'Попробуйте изменить запрос или сбросить фильтр.'
              : tab === 'services'
                ? 'Добавьте первую услугу — она сразу появится в форме записи для клиентов.'
                : 'Пакет объединяет несколько услуг по одной цене и помогает увеличить средний чек.'}
          </p>
          {query || filter !== 'all' ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Сбросить фильтры
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Plus /> {tab === 'services' ? 'Новая услуга' : 'Новый пакет'}
            </button>
          )}
        </div>
      ) : tab === 'services' ? (
        <div className="srv-grid">
          {filteredServices.map((service) => {
            const index = services.findIndex((item) => item.id === service.id);
            return (
              <ServiceCard
                key={service.id}
                service={service}
                currency={currency}
                canUp={index > 0}
                canDown={index >= 0 && index < services.length - 1}
                onEdit={() => {
                  setFormError(null);
                  setServiceModal({ open: true, service });
                }}
                onDuplicate={() => void duplicate('services', service)}
                onToggle={() => void toggleActive('services', service)}
                onDelete={() => setDeleteTarget({ kind: 'services', item: service })}
                onMove={(direction) => void move('services', service, direction)}
              />
            );
          })}
        </div>
      ) : (
        <div className="srv-grid">
          {filteredPackages.map((item) => {
            const index = packages.findIndex((entry) => entry.id === item.id);
            return (
              <PackageCard
                key={item.id}
                item={item}
                services={services}
                currency={currency}
                canUp={index > 0}
                canDown={index >= 0 && index < packages.length - 1}
                onEdit={() => {
                  setFormError(null);
                  setPackageModal({ open: true, item });
                }}
                onDuplicate={() => void duplicate('packages', item)}
                onToggle={() => void toggleActive('packages', item)}
                onDelete={() => setDeleteTarget({ kind: 'packages', item })}
                onMove={(direction) => void move('packages', item, direction)}
              />
            );
          })}
        </div>
      )}

      <ServiceModal
        open={serviceModal.open}
        service={serviceModal.service}
        currency={currency}
        saving={saving}
        serverError={formError}
        onClose={() => setServiceModal({ open: false, service: null })}
        onSubmit={(draft) => void submitService(draft)}
      />

      <PackageModal
        open={packageModal.open}
        item={packageModal.item}
        services={services}
        currency={currency}
        saving={saving}
        serverError={formError}
        onClose={() => setPackageModal({ open: false, item: null })}
        onSubmit={(draft) => void submitPackage(draft)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'services' ? 'Удалить услугу?' : 'Удалить пакет?'}
        confirmLabel="Удалить"
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        message={
          <>
            <p>
              «{deleteTarget?.item.name}» исчезнет из формы записи и списка{' '}
              {deleteTarget?.kind === 'services' ? 'услуг' : 'пакетов'}.
              {deleteTarget && deleteTarget.item.bookings > 0
                ? ` В истории останется ${deleteTarget.item.bookings} записей — они не пострадают.`
                : ''}
            </p>
            {deleteTarget?.kind === 'services' && deleteTargetPackages.length > 0 && (
              <p className="confirm-body__muted">
                Услуга входит в пакеты: {deleteTargetPackages.map((item) => `«${item.name}»`).join(', ')} — из них она
                пропадёт.
              </p>
            )}
            <p className="confirm-body__muted">Восстановить позицию нельзя — можно создать заново.</p>
          </>
        }
      />
    </div>
  );
}
