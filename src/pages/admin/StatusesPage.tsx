import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  ChevronRight,
  CircleDot,
  Info,
  Plus,
  RefreshCw,
  TriangleAlert,
  Users
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { StatusCard } from '../../components/statuses/StatusCard';
import { StatusModal } from '../../components/statuses/StatusModal';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import { plural } from '../../lib/utils';
import type { StatusDraft, StatusSettingsItem, StatusesSettingsPayload } from '../../types';

export function StatusesPage() {
  const { subscribe } = useRealtime();
  const { toast } = useToast();

  const [data, setData] = useState<StatusesSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; status: StatusSettingsItem | null }>({
    open: false,
    status: null
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<StatusSettingsItem | null>(null);
  const [moveTo, setMoveTo] = useState<string>('');

  const dragId = useRef<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await api.get<StatusesSettingsPayload>('/statuses');
      setData(next);
      setError(null);
    } catch (err) {
      if (!silent) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить статусы');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const off = subscribe('status', () => void load(true));
    return off;
  }, [subscribe, load]);

  const statuses = data?.statuses || [];
  const flow = useMemo(() => statuses.filter((item) => !item.isCancelled), [statuses]);
  const cancelStatuses = useMemo(() => statuses.filter((item) => item.isCancelled), [statuses]);

  const apply = (next: StatusesSettingsPayload) => setData(next);

  const notifyError = (err: unknown, fallback: string) =>
    toast({
      title: fallback,
      subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
      variant: 'error'
    });

  const submit = async (draft: StatusDraft) => {
    setSaving(true);
    setFormError(null);
    try {
      const editing = modal.status;
      const next = editing
        ? await api.patch<StatusesSettingsPayload>(`/statuses/${editing.id}`, draft)
        : await api.post<StatusesSettingsPayload>('/statuses', draft);
      apply(next);
      setModal({ open: false, status: null });
      toast({
        title: editing ? 'Статус обновлён' : 'Статус создан',
        subtitle: draft.name,
        variant: 'success'
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить статус');
    } finally {
      setSaving(false);
    }
  };

  const shift = async (status: StatusSettingsItem, direction: -1 | 1) => {
    setBusy(true);
    const snapshot = data;
    if (data) {
      const ordered = [...data.statuses];
      const index = ordered.findIndex((item) => item.id === status.id);
      const target = index + direction;
      if (target >= 0 && target < ordered.length) {
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        setData({ ...data, statuses: ordered });
      }
    }
    try {
      const next = await api.post<StatusesSettingsPayload>(`/statuses/${status.id}/shift`, { direction });
      apply(next);
    } catch (err) {
      if (snapshot) setData(snapshot);
      notifyError(err, 'Не удалось изменить порядок');
    } finally {
      setBusy(false);
    }
  };

  const dropOn = async (targetId: number) => {
    const sourceId = dragId.current;
    setDragOverId(null);
    dragId.current = null;
    if (!sourceId || sourceId === targetId || !data) return;
    const ordered = [...data.statuses];
    const from = ordered.findIndex((item) => item.id === sourceId);
    const to = ordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const snapshot = data;
    setData({ ...data, statuses: ordered });
    try {
      const next = await api.post<StatusesSettingsPayload>('/statuses/reorder', {
        ids: ordered.map((item) => item.id)
      });
      apply(next);
    } catch (err) {
      setData(snapshot);
      notifyError(err, 'Не удалось изменить порядок');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const query = moveTo ? `?moveTo=${moveTo}` : '';
      const next = await api.del<StatusesSettingsPayload & { moved: number }>(`/statuses/${deleteTarget.id}${query}`);
      apply(next);
      toast({
        title: 'Статус удалён',
        subtitle: next.moved
          ? `${next.moved} ${plural(next.moved, 'запись', 'записи', 'записей')} переведены`
          : 'Записей в нём не было',
        variant: 'success'
      });
      setDeleteTarget(null);
    } catch (err) {
      notifyError(err, 'Не удалось удалить статус');
    } finally {
      setBusy(false);
    }
  };

  const deleteOptions = useMemo(
    () => statuses.filter((item) => item.id !== deleteTarget?.id && !item.isCancelled),
    [statuses, deleteTarget]
  );

  const clientFriendly = statuses.filter((item) => item.clientCanReschedule || item.clientCanCancel).length;

  return (
    <div className="page st-page">
      <PageHead
        title="Статусы"
        subtitle={
          data
            ? `${statuses.length} ${plural(statuses.length, 'статус', 'статуса', 'статусов')} · ${data.total} ${plural(
                data.total,
                'запись',
                'записи',
                'записей'
              )} · у ${clientFriendly} есть действия для клиента`
            : 'Цепочка работы с записями и права клиента'
        }
        actions={
          <>
            <button
              type="button"
              className={`btn btn--icon btn--bordered${busy ? ' btn--loading' : ''}`}
              onClick={() => void load(true)}
              aria-label="Обновить"
            >
              <RefreshCw />
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setFormError(null);
                setModal({ open: true, status: null });
              }}
            >
              <Plus /> <span>Новый статус</span>
            </button>
          </>
        }
      />

      {loading && !data && (
        <div className="st-list">
          {Array.from({ length: 5 }).map((_, index) => (
            <span className="skeleton st-skeleton" key={index} />
          ))}
        </div>
      )}

      {error && !data && (
        <div className="st-error">
          <TriangleAlert />
          <div>
            <b>Не удалось загрузить статусы</b>
            <span>{error}</span>
          </div>
          <button type="button" className="btn btn--sm" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="card st-flow">
            <header className="st-flow__head">
              <div>
                <b>Цепочка работы</b>
                <span>Перетащите карточку или используйте стрелки — порядок сразу виден в разделе «Записи»</span>
              </div>
              <span className="badge badge--accent">
                <CircleDot /> {flow.length} шагов
              </span>
            </header>

            <div className="st-flow__rail" role="list">
              {flow.map((status, index) => (
                <span className="st-flow__node" key={status.id}>
                  <span className="st-flow__pill" style={{ borderColor: status.color, color: status.color }}>
                    <i style={{ background: status.color }} aria-hidden />
                    {status.name}
                  </span>
                  {index < flow.length - 1 && <ChevronRight className="st-flow__arrow" />}
                </span>
              ))}
            </div>
          </div>

          <div className="st-grid">
            <section className="st-column">
              <header className="st-column__head">
                <h2>Основные статусы</h2>
                <span>Порядок и права на перенос/отмену</span>
              </header>

              <div className="st-list">
                {flow.map((status, index) => (
                  <StatusCard
                    key={status.id}
                    status={status}
                    index={index}
                    total={flow.length}
                    active={dragOverId === status.id}
                    onEdit={() => {
                      setFormError(null);
                      setModal({ open: true, status });
                    }}
                    onDelete={() => {
                      setDeleteTarget(status);
                      const fallback = statuses.find((item) => item.id !== status.id && !item.isCancelled);
                      setMoveTo(fallback ? String(fallback.id) : '');
                    }}
                    onShift={(direction) => void shift(status, direction)}
                    onDragStart={() => {
                      dragId.current = status.id;
                    }}
                    onDragOver={() => setDragOverId(status.id)}
                    onDrop={() => void dropOn(status.id)}
                    onDragEnd={() => {
                      dragId.current = null;
                      setDragOverId(null);
                    }}
                  />
                ))}
              </div>
            </section>

            <aside className="st-column">
              <header className="st-column__head">
                <h2>Статусы отмены</h2>
                <span>Запись уходит из активных, история остаётся</span>
              </header>

              <div className="st-list">
                {cancelStatuses.map((status) => (
                  <StatusCard
                    key={status.id}
                    status={status}
                    index={0}
                    total={1}
                    active={false}
                    onEdit={() => {
                      setFormError(null);
                      setModal({ open: true, status });
                    }}
                    onDelete={() => {
                      setDeleteTarget(status);
                      const fallback = statuses.find((item) => item.id !== status.id && !item.isCancelled);
                      setMoveTo(fallback ? String(fallback.id) : '');
                    }}
                    onShift={() => undefined}
                    onDragStart={() => undefined}
                    onDragOver={() => undefined}
                    onDrop={() => undefined}
                    onDragEnd={() => undefined}
                  />
                ))}
                {cancelStatuses.length === 0 && (
                  <div className="st-empty">
                    <span className="st-empty__icon">
                      <CircleDot />
                    </span>
                    <b>Нет статуса отмены</b>
                    <span>Создайте статус с флагом «отмена», чтобы отклонять заявки.</span>
                  </div>
                )}
              </div>

              <section className="card st-info">
                <header>
                  <span className="st-info__icon">
                    <CalendarCheck />
                  </span>
                  <div>
                    <b>Права клиента</b>
                    <span>Работают на странице записи /b/…</span>
                  </div>
                </header>
                <ul>
                  {statuses.map((status) => (
                    <li key={status.id} style={{ '--status': status.color } as React.CSSProperties}>
                      <i aria-hidden />
                      <span>{status.name}</span>
                      <em>
                        {status.clientCanReschedule ? 'перенос' : ''}
                        {status.clientCanReschedule && status.clientCanCancel ? ' · ' : ''}
                        {status.clientCanCancel ? 'отмена' : ''}
                        {!status.clientCanReschedule && !status.clientCanCancel ? 'только фотограф' : ''}
                      </em>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="st-hint">
                <Info />
                <span>
                  Статус отмены всегда стоит последним в цепочке. Записи из удаляемого статуса переводятся в
                  выбранный — ничего не потеряется.
                </span>
              </div>

              {data.archived > 0 && (
                <div className="st-hint st-hint--muted">
                  <Users />
                  <span>Архивных статусов: {data.archived}. Они не показываются в списке, но история записей цела.</span>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      <StatusModal
        open={modal.open}
        status={modal.status}
        saving={saving}
        error={formError}
        onClose={() => setModal({ open: false, status: null })}
        onSubmit={(draft) => void submit(draft)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Удалить статус?"
        message={
          <div className="st-delete">
            <p>
              Статус <b>«{deleteTarget?.name}»</b> исчезнет из цепочки.
              {deleteTarget && deleteTarget.bookings > 0
                ? ` В нём ${deleteTarget.bookings} ${plural(
                    deleteTarget.bookings,
                    'запись',
                    'записи',
                    'записей'
                  )} — переведём их в выбранный статус, события сохранятся.`
                : ' Записей в нём нет.'}
            </p>
            {deleteTarget && deleteTarget.bookings > 0 && (
              <label className="field">
                <span className="field__label">Перевести записи в</span>
                <select className="select" value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                  {deleteOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        }
        confirmLabel="Удалить статус"
        busy={busy}
        icon={<CircleDot />}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
