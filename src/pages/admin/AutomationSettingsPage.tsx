import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleSlash,
  Clock3,
  History,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Tag,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Modal } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/Switch';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { useRealtime } from '../../context/RealtimeContext';
import { api, ApiError } from '../../lib/api';
import { formatDate, plural } from '../../lib/utils';
import type {
  AutomationAction,
  AutomationLogItem,
  AutomationRule,
  AutomationRulesPayload,
  AutomationTrigger
} from '../../types';

type Draft = {
  name: string;
  trigger: AutomationTrigger;
  hours: number;
  days: number;
  triggerStatusId: number | null;
  serviceId: number | null;
  minAmount: number;
  source: '' | 'client' | 'admin';
  clientTag: string;
  action: AutomationAction;
  templateKey: string;
  channel: '' | 'telegram' | 'email';
  actionStatusId: number | null;
  tag: string;
  amount: number;
  notificationTitle: string;
  isActive: boolean;
};

const TRIGGER_ORDER: AutomationTrigger[] = ['booking_created', 'status_changed', 'before_shoot', 'after_shoot', 'no_visits'];
const ACTION_ORDER: AutomationAction[] = ['message', 'notification', 'status', 'tag', 'bonus'];

const TRIGGER_LABEL: Record<AutomationTrigger, string> = {
  booking_created: 'Новая заявка',
  status_changed: 'Смена статуса',
  before_shoot: 'До съёмки',
  after_shoot: 'После съёмки',
  no_visits: 'Клиент пропал'
};

const ACTION_LABEL: Record<AutomationAction, string> = {
  message: 'Написать клиенту',
  notification: 'Уведомить фотографа',
  status: 'Сменить статус',
  tag: 'Добавить метку',
  bonus: 'Начислить баллы'
};

const ACTION_ICON: Record<AutomationAction, typeof Zap> = {
  message: Sparkles,
  notification: UserRound,
  status: Play,
  tag: Tag,
  bonus: Zap
};

function emptyDraft(): Draft {
  return {
    name: '',
    trigger: 'booking_created',
    hours: 24,
    days: 1,
    triggerStatusId: null,
    serviceId: null,
    minAmount: 0,
    source: '',
    clientTag: '',
    action: 'message',
    templateKey: '',
    channel: '',
    actionStatusId: null,
    tag: '',
    amount: 500,
    notificationTitle: '',
    isActive: true
  };
}

function draftFromRule(rule: AutomationRule): Draft {
  return {
    name: rule.name,
    trigger: rule.trigger,
    hours: Number(rule.params.hours) || 24,
    days: Number(rule.params.days) || 1,
    triggerStatusId: rule.params.statusId ? Number(rule.params.statusId) : null,
    serviceId: rule.conditions.serviceId ? Number(rule.conditions.serviceId) : null,
    minAmount: Number(rule.conditions.minAmount) || 0,
    source: rule.conditions.source || '',
    clientTag: rule.conditions.clientTag || '',
    action: rule.action,
    templateKey: rule.actionParams.templateKey || '',
    channel: rule.actionParams.channel || '',
    actionStatusId: rule.actionParams.statusId ? Number(rule.actionParams.statusId) : null,
    tag: rule.actionParams.tag || '',
    amount: Number(rule.actionParams.amount) || 500,
    notificationTitle: rule.actionParams.title || '',
    isActive: rule.isActive
  };
}

function triggerSummary(rule: AutomationRule): string {
  if (rule.trigger === 'before_shoot') {
    const hours = Number(rule.params.hours) || 24;
    return hours >= 24 && hours % 24 === 0
      ? `за ${hours / 24} ${plural(hours / 24, 'день', 'дня', 'дней')}`
      : `за ${hours} ${plural(hours, 'час', 'часа', 'часов')}`;
  }
  if (rule.trigger === 'after_shoot') {
    const days = Number(rule.params.days) || 1;
    return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }
  if (rule.trigger === 'no_visits') {
    const days = Number(rule.params.days) || 60;
    return `молчание ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }
  return '';
}

export function AutomationSettingsPage() {
  const { toast } = useToast();
  const { subscribe } = useRealtime();
  const [data, setData] = useState<AutomationRulesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AutomationRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await api.get<AutomationRulesPayload>('/automation/rules');
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить сценарии');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribe('automation', () => void load(true)), [subscribe, load]);

  const openEditor = (rule: AutomationRule | null) => {
    setEditing(rule);
    setDraft(rule ? draftFromRule(rule) : emptyDraft());
    setFormError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    if (draft.name.trim().length < 2) {
      setFormError('Укажите название сценария');
      return;
    }
    if (draft.action === 'message' && !draft.templateKey) {
      setFormError('Выберите шаблон сообщения');
      return;
    }
    if (draft.trigger === 'status_changed' && !draft.triggerStatusId) {
      setFormError('Выберите статус, по которому срабатывает сценарий');
      return;
    }
    if (draft.action === 'status' && !draft.actionStatusId) {
      setFormError('Выберите статус, в который переводить запись');
      return;
    }

    const payload = {
      name: draft.name.trim(),
      trigger: draft.trigger,
      params:
        draft.trigger === 'before_shoot'
          ? { hours: draft.hours }
          : draft.trigger === 'after_shoot'
            ? { days: draft.days }
            : draft.trigger === 'no_visits'
              ? { days: draft.days }
              : { statusId: draft.triggerStatusId },
      conditions: {
        serviceId: draft.serviceId,
        minAmount: draft.minAmount,
        source: draft.source || null,
        clientTag: draft.clientTag.trim() || null
      },
      action: draft.action,
      actionParams:
        draft.action === 'message'
          ? { templateKey: draft.templateKey, channel: draft.channel || null }
          : draft.action === 'status'
            ? { statusId: draft.actionStatusId }
            : draft.action === 'tag'
              ? { tag: draft.tag.trim() || 'Автоматизация' }
              : draft.action === 'bonus'
                ? { amount: draft.amount }
                : { title: draft.notificationTitle.trim() || null },
      isActive: draft.isActive
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) await api.patch(`/automation/rules/${editing.id}`, payload);
      else await api.post('/automation/rules', payload);
      setEditorOpen(false);
      toast({
        title: editing ? 'Сценарий обновлён' : 'Сценарий создан',
        subtitle: draft.name.trim(),
        variant: 'success'
      });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить сценарий');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule: AutomationRule, value: boolean) => {
    setBusyId(rule.id);
    try {
      await api.patch(`/automation/rules/${rule.id}`, { isActive: value });
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((item) => (item.id === rule.id ? { ...item, isActive: value } : item)) } : prev
      );
      toast({ title: value ? 'Сценарий включён' : 'Сценарий выключен', subtitle: rule.name, variant: 'success' });
    } catch (err) {
      toast({ title: 'Не удалось изменить сценарий', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const runNow = async (rule: AutomationRule) => {
    setBusyId(rule.id);
    try {
      const result = await api.post<{ message: string }>(`/automation/rules/${rule.id}/run`, {});
      toast({ title: 'Сценарий выполнен', subtitle: result.message, variant: 'success' });
      await load(true);
    } catch (err) {
      toast({
        title: 'Сценарий пропущен',
        subtitle: err instanceof ApiError ? err.message : 'Не удалось выполнить',
        variant: 'error'
      });
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/automation/rules/${confirmDelete.id}`);
      toast({ title: 'Сценарий удалён', subtitle: confirmDelete.name, variant: 'success' });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast({ title: 'Не удалось удалить', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const stats = useMemo(() => {
    const items = data?.items || [];
    const log = data?.log || [];
    const month = new Date().toISOString().slice(0, 7);
    return {
      active: items.filter((item) => item.isActive).length,
      total: items.length,
      sent: log.filter((entry) => entry.status === 'ok' && String(entry.createdAt).slice(0, 7) === month).length,
      skipped: log.filter((entry) => entry.status === 'skipped').length
    };
  }, [data]);

  const templateName = (key: string) => data?.meta.templates.find((item) => item.key === key)?.name || key;

  return (
    <div className="page auto-page">
      <PageHead
        title="Автоматизация"
        subtitle={`${stats.active} из ${stats.total} сценариев работают · ${stats.sent} ${plural(
          stats.sent,
          'сообщение',
          'сообщения',
          'сообщений'
        )} за месяц`}
        actions={
          <>
            <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
              <RefreshCw />
            </button>
            <button type="button" className="btn btn--primary" onClick={() => openEditor(null)}>
              <Plus /> <span>Новый сценарий</span>
            </button>
          </>
        }
      />

      <div className="auto-stats">
        <div className="auto-stat">
          <span className="auto-stat__icon">
            <Zap />
          </span>
          <div>
            <em>Активных сценариев</em>
            <b className="tnum">{stats.active}</b>
          </div>
        </div>
        <div className="auto-stat">
          <span className="auto-stat__icon">
            <Check />
          </span>
          <div>
            <em>Выполнено за месяц</em>
            <b className="tnum">{stats.sent}</b>
          </div>
        </div>
        <div className="auto-stat">
          <span className="auto-stat__icon">
            <CircleSlash />
          </span>
          <div>
            <em>Пропущено</em>
            <b className="tnum">{stats.skipped}</b>
          </div>
        </div>
      </div>

      {error && !loading && (
        <div className="auto-error" role="alert">
          <X /> <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="auto-rules">
          {Array.from({ length: 3 }).map((_, index) => (
            <span className="skeleton auto-rule-skeleton" key={index} />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="bookings-empty">
          <span className="bookings-empty__icon">
            <Zap />
          </span>
          <b>Сценариев пока нет</b>
          <span>Создайте первый: напишите клиенту после заявки или напомните о съёмке за сутки.</span>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="auto-rules">
          {data.items.map((rule) => {
            const ActionIcon = ACTION_ICON[rule.action] || Zap;
            return (
              <article className="auto-rule" key={rule.id} data-off={!rule.isActive || undefined}>
                <div className="auto-rule__head">
                  <span className="auto-rule__icon" data-action={rule.action}>
                    <ActionIcon />
                  </span>
                  <div className="auto-rule__title">
                    <b>{rule.name}</b>
                    <span>
                      {rule.isActive ? 'работает' : 'выключен'}
                      {rule.runs > 0 ? ` · ${rule.runs} ${plural(rule.runs, 'запуск', 'запуска', 'запусков')}` : ''}
                    </span>
                  </div>
                  <Switch
                    checked={rule.isActive}
                    label={`Сценарий ${rule.name}`}
                    disabled={busyId === rule.id}
                    onChange={(value) => void toggle(rule, value)}
                  />
                </div>

                <div className="auto-rule__flow">
                  <span className="auto-chip" data-kind="trigger">
                    <Clock3 />
                    {TRIGGER_LABEL[rule.trigger]}
                    {triggerSummary(rule) && <em>{triggerSummary(rule)}</em>}
                  </span>
                  <ArrowRight className="auto-rule__arrow" />
                  <span className="auto-chip" data-kind="action">
                    <ActionIcon />
                    {ACTION_LABEL[rule.action]}
                    {rule.action === 'message' && <em>{templateName(rule.actionParams.templateKey || '')}</em>}
                    {rule.action === 'bonus' && <em>+{rule.actionParams.amount} баллов</em>}
                    {rule.action === 'tag' && <em>{rule.actionParams.tag}</em>}
                  </span>
                </div>

                {(rule.conditions.serviceId || rule.conditions.minAmount || rule.conditions.source || rule.conditions.clientTag) && (
                  <div className="auto-rule__conditions">
                    {rule.conditions.serviceId && (
                      <span>
                        услуга:{' '}
                        {data.meta.services.find((service) => service.id === rule.conditions.serviceId)?.name || '—'}
                      </span>
                    )}
                    {rule.conditions.minAmount ? <span>чек от {rule.conditions.minAmount} ₽</span> : null}
                    {rule.conditions.source && (
                      <span>{rule.conditions.source === 'client' ? 'только с сайта' : 'только вручную'}</span>
                    )}
                    {rule.conditions.clientTag && <span>метка «{rule.conditions.clientTag}»</span>}
                  </div>
                )}

                <footer className="auto-rule__foot">
                  <span className="auto-rule__last">
                    <History />
                    {rule.lastRunAt
                      ? `последний запуск ${formatDate(rule.lastRunAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                      : 'ещё не запускался'}
                  </span>
                  <div className="auto-rule__actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={busyId === rule.id}
                      onClick={() => void runNow(rule)}
                    >
                      <Play /> Проверить
                    </button>
                    <button type="button" className="btn btn--icon btn--ghost" aria-label={`Изменить ${rule.name}`} onClick={() => openEditor(rule)}>
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      className="btn btn--icon btn--ghost auto-rule__delete"
                      aria-label={`Удалить ${rule.name}`}
                      onClick={() => setConfirmDelete(rule)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {data && data.log.length > 0 && (
        <section className="auto-log">
          <header className="auto-log__head">
            <h3>
              <History /> Журнал запусков
            </h3>
            <span>последние {data.log.length}</span>
          </header>
          <ul>
            {data.log.map((entry: AutomationLogItem) => (
              <li key={entry.id} data-status={entry.status}>
                <span className="auto-log__dot" />
                <span className="auto-log__message">{entry.message}</span>
                <span className="auto-log__time">
                  {formatDate(entry.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Сценарий автоматизации' : 'Новый сценарий'}
        subtitle="Событие, условие и действие"
        icon={<Zap />}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
              Отмена
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void save()}>
              {editing ? 'Сохранить сценарий' : 'Создать сценарий'}
            </button>
          </>
        }
      >
        <div className="auto-form">
          {formError && (
            <div className="auto-error" role="alert">
              <TriangleAlert /> <span>{formError}</span>
            </div>
          )}

          <label className="field">
            <span className="field__label">Название</span>
            <input
              className="input"
              value={draft.name}
              maxLength={90}
              placeholder="Например, напоминание за сутки"
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <div className="field">
            <span className="field__label">Когда запускать</span>
            <div className="auto-picker">
              {TRIGGER_ORDER.map((trigger) => {
                const meta = data?.meta.triggers.find((item) => item.id === trigger);
                return (
                  <button
                    key={trigger}
                    type="button"
                    className="auto-picker__btn"
                    data-active={draft.trigger === trigger || undefined}
                    onClick={() => setDraft((prev) => ({ ...prev, trigger }))}
                  >
                    <b>{meta?.label || TRIGGER_LABEL[trigger]}</b>
                    <em>{meta?.hint}</em>
                  </button>
                );
              })}
            </div>
          </div>

          {draft.trigger === 'status_changed' && (
            <label className="field">
              <span className="field__label">Статус записи</span>
              <select
                className="input"
                value={draft.triggerStatusId ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, triggerStatusId: event.target.value ? Number(event.target.value) : null }))
                }
              >
                <option value="">Выберите статус</option>
                {(data?.meta.statuses || []).map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.trigger === 'before_shoot' && (
            <label className="field">
              <span className="field__label">За сколько часов до съёмки</span>
              <input
                className="input"
                type="number"
                min={1}
                max={168}
                value={draft.hours}
                onChange={(event) => setDraft((prev) => ({ ...prev, hours: Number(event.target.value) }))}
              />
              <span className="field__hint">24 часа — напоминание за день, 2 — за пару часов</span>
            </label>
          )}

          {(draft.trigger === 'after_shoot' || draft.trigger === 'no_visits') && (
            <label className="field">
              <span className="field__label">
                {draft.trigger === 'after_shoot' ? 'Через сколько дней после съёмки' : 'Сколько дней без съёмок'}
              </span>
              <input
                className="input"
                type="number"
                min={draft.trigger === 'no_visits' ? 7 : 0}
                max={draft.trigger === 'no_visits' ? 730 : 60}
                value={draft.days}
                onChange={(event) => setDraft((prev) => ({ ...prev, days: Number(event.target.value) }))}
              />
            </label>
          )}

          <div className="auto-form__section">
            <span className="auto-form__label">Условия (необязательно)</span>
            <div className="auto-form__row">
              <label className="field">
                <span className="field__label">Услуга</span>
                <select
                  className="input"
                  value={draft.serviceId ?? ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, serviceId: event.target.value ? Number(event.target.value) : null }))}
                >
                  <option value="">Любая услуга</option>
                  {(data?.meta.services || []).map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Чек не меньше</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.minAmount}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minAmount: Number(event.target.value) }))}
                />
              </label>
            </div>
            <div className="auto-form__row">
              <label className="field">
                <span className="field__label">Источник записи</span>
                <select
                  className="input"
                  value={draft.source}
                  onChange={(event) => setDraft((prev) => ({ ...prev, source: event.target.value as Draft['source'] }))}
                >
                  <option value="">Неважно</option>
                  <option value="client">Только с сайта</option>
                  <option value="admin">Только созданные вручную</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Метка клиента</span>
                <input
                  className="input"
                  value={draft.clientTag}
                  maxLength={24}
                  placeholder="Например, VIP"
                  onChange={(event) => setDraft((prev) => ({ ...prev, clientTag: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="field">
            <span className="field__label">Что сделать</span>
            <div className="auto-picker auto-picker--actions">
              {ACTION_ORDER.map((action) => {
                const meta = data?.meta.actions.find((item) => item.id === action);
                return (
                  <button
                    key={action}
                    type="button"
                    className="auto-picker__btn"
                    data-active={draft.action === action || undefined}
                    onClick={() => setDraft((prev) => ({ ...prev, action }))}
                  >
                    <b>{meta?.label || ACTION_LABEL[action]}</b>
                    <em>{meta?.hint}</em>
                  </button>
                );
              })}
            </div>
          </div>

          {draft.action === 'message' && (
            <div className="auto-form__row">
              <label className="field">
                <span className="field__label">Шаблон</span>
                <select
                  className="input"
                  value={draft.templateKey}
                  onChange={(event) => setDraft((prev) => ({ ...prev, templateKey: event.target.value }))}
                >
                  <option value="">Выберите шаблон</option>
                  {(data?.meta.templates || []).map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name} · {template.channel === 'email' ? 'почта' : 'Telegram'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Канал</span>
                <select
                  className="input"
                  value={draft.channel}
                  onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value as Draft['channel'] }))}
                >
                  <option value="">Как в шаблоне</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Почта</option>
                </select>
              </label>
            </div>
          )}

          {draft.action === 'notification' && (
            <label className="field">
              <span className="field__label">Заголовок уведомления</span>
              <input
                className="input"
                value={draft.notificationTitle}
                maxLength={120}
                placeholder="Например, клиент давно не записывался"
                onChange={(event) => setDraft((prev) => ({ ...prev, notificationTitle: event.target.value }))}
              />
            </label>
          )}

          {draft.action === 'status' && (
            <label className="field">
              <span className="field__label">Новый статус</span>
              <select
                className="input"
                value={draft.actionStatusId ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, actionStatusId: event.target.value ? Number(event.target.value) : null }))
                }
              >
                <option value="">Выберите статус</option>
                {(data?.meta.statuses || []).map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.action === 'tag' && (
            <label className="field">
              <span className="field__label">Метка</span>
              <input
                className="input"
                value={draft.tag}
                maxLength={24}
                placeholder="Постоянный"
                onChange={(event) => setDraft((prev) => ({ ...prev, tag: event.target.value }))}
              />
            </label>
          )}

          {draft.action === 'bonus' && (
            <label className="field">
              <span className="field__label">Сколько баллов начислить</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100000}
                value={draft.amount}
                onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))}
              />
            </label>
          )}

          <div className="auto-switch-row">
            <div>
              <b>Сценарий активен</b>
              <span>Выключенный сценарий не запускается ни по событию, ни по времени</span>
            </div>
            <Switch
              checked={draft.isActive}
              label="Сценарий активен"
              onChange={(value) => setDraft((prev) => ({ ...prev, isActive: value }))}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Удалить сценарий?"
        message={<>Сценарий «{confirmDelete?.name}» перестанет запускаться, его журнал останется в истории.</>}
        confirmLabel="Удалить сценарий"
        busy={deleting}
        icon={<Trash2 />}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
