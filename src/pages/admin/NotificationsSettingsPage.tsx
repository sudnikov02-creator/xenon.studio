import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Check,
  Eye,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Modal } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/Switch';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { api, ApiError } from '../../lib/api';
import type { NotificationTemplate, TemplateListPayload } from '../../types';

type Draft = {
  name: string;
  channel: 'telegram' | 'email';
  subject: string;
  body: string;
  isActive: boolean;
};

const EMPTY: Draft = { name: '', channel: 'telegram', subject: '', body: '', isActive: true };

const CHANNEL_META = {
  telegram: { label: 'Telegram', icon: Send },
  email: { label: 'Почта', icon: Mail },
  push: { label: 'Push', icon: BellRing }
} as const;

export function NotificationsSettingsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<TemplateListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NotificationTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.get<TemplateListPayload>('/automation/templates');
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить шаблоны');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (template: NotificationTemplate | null) => {
    setEditing(template);
    setDraft(
      template
        ? {
            name: template.name,
            channel: template.channel === 'email' ? 'email' : 'telegram',
            subject: template.subject || '',
            body: template.body,
            isActive: template.isActive
          }
        : { ...EMPTY }
    );
    setFormError(null);
    setPreview(null);
    setEditorOpen(true);
  };

  const refreshPreview = useCallback((next: Draft) => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      api
        .post<{ subject: string; body: string }>('/automation/templates/preview', {
          body: next.body,
          subject: next.channel === 'email' ? next.subject : ''
        })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 260);
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    refreshPreview(draft);
  }, [draft, editorOpen, refreshPreview]);

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const area = bodyRef.current;
    if (!area) {
      setDraft((prev) => ({ ...prev, body: `${prev.body}${token}` }));
      return;
    }
    const start = area.selectionStart ?? draft.body.length;
    const end = area.selectionEnd ?? draft.body.length;
    const nextBody = `${draft.body.slice(0, start)}${token}${draft.body.slice(end)}`;
    setDraft((prev) => ({ ...prev, body: nextBody }));
    requestAnimationFrame(() => {
      area.focus();
      const caret = start + token.length;
      area.setSelectionRange(caret, caret);
    });
  };

  const save = async () => {
    if (draft.name.trim().length < 2) {
      setFormError('Укажите название шаблона');
      return;
    }
    if (draft.body.trim().length < 5) {
      setFormError('Добавьте текст сообщения');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        channel: draft.channel,
        subject: draft.channel === 'email' ? draft.subject.trim() : null,
        body: draft.body,
        isActive: draft.isActive
      };
      if (editing) await api.patch(`/automation/templates/${editing.id}`, payload);
      else await api.post('/automation/templates', payload);
      setEditorOpen(false);
      toast({
        title: editing ? 'Шаблон обновлён' : 'Шаблон создан',
        subtitle: draft.name.trim(),
        variant: 'success'
      });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось сохранить шаблон');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (template: NotificationTemplate, value: boolean) => {
    setBusyId(template.id);
    try {
      await api.patch(`/automation/templates/${template.id}`, { isActive: value });
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((item) => (item.id === template.id ? { ...item, isActive: value } : item)) } : prev
      );
      toast({
        title: value ? 'Шаблон включён' : 'Шаблон выключен',
        subtitle: template.name,
        variant: 'success'
      });
    } catch (err) {
      toast({ title: 'Не удалось изменить шаблон', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del(`/automation/templates/${confirmDelete.id}`);
      toast({ title: 'Шаблон удалён', subtitle: confirmDelete.name, variant: 'success' });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast({ title: 'Не удалось удалить', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const groups = useMemo(() => {
    const items = data?.items || [];
    return {
      active: items.filter((item) => item.isActive).length,
      total: items.length
    };
  }, [data]);

  return (
    <div className="page auto-page">
      <PageHead
        title="Уведомления и шаблоны"
        subtitle={`${groups.active} из ${groups.total} шаблонов включены · переменные подставляются автоматически`}
        actions={
          <>
            <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
              <RefreshCw />
            </button>
            <button type="button" className="btn btn--primary" onClick={() => openEditor(null)}>
              <Plus /> <span>Новый шаблон</span>
            </button>
          </>
        }
      />

      <div className="auto-hint">
        <Sparkles />
        <span>
          В тексте можно писать <code>{'{{client_name}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>,{' '}
          <code>{'{{service}}'}</code>, <code>{'{{price}}'}</code>, <code>{'{{link}}'}</code> — при отправке подставятся
          данные конкретной записи.
        </span>
      </div>

      {error && !loading && (
        <div className="auto-error" role="alert">
          <X /> <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="tpl-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <span className="skeleton tpl-skeleton" key={index} />
          ))}
        </div>
      )}

      {data && (
        <div className="tpl-grid">
          {data.items.map((template) => {
            const meta = CHANNEL_META[template.channel] ?? CHANNEL_META.telegram;
            const ChannelIcon = meta.icon;
            return (
              <article className="tpl-card" key={template.id} data-off={!template.isActive || undefined}>
                <header className="tpl-card__head">
                  <span className="tpl-card__icon" data-channel={template.channel}>
                    <ChannelIcon />
                  </span>
                  <div className="tpl-card__title">
                    <b>{template.name}</b>
                    <span>
                      {meta.label}
                      {template.isSystem ? ' · системный' : ' · свой'}
                    </span>
                  </div>
                  <Switch
                    checked={template.isActive}
                    label={`Шаблон ${template.name}`}
                    disabled={busyId === template.id}
                    onChange={(value) => void toggle(template, value)}
                  />
                </header>

                {template.subject && <div className="tpl-card__subject">{template.subject}</div>}

                <p className="tpl-card__body">{template.body}</p>

                <footer className="tpl-card__foot">
                  <span className="tpl-card__key">{template.key}</span>
                  <div className="tpl-card__actions">
                    {!template.isSystem && (
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        aria-label={`Удалить ${template.name}`}
                        onClick={() => setConfirmDelete(template)}
                      >
                        <Trash2 />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--soft btn--sm"
                      onClick={() => openEditor(template)}
                    >
                      <Pencil /> Изменить
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Шаблон сообщения' : 'Новый шаблон'}
        subtitle={editing ? editing.key : 'Свой шаблон для автоматизации'}
        icon={<MessageSquare />}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
              Отмена
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--primary" disabled={saving} onClick={() => void save()}>
              {editing ? 'Сохранить шаблон' : 'Создать шаблон'}
            </button>
          </>
        }
      >
        <div className="tpl-editor">
          <div className="tpl-editor__main">
            {formError && (
              <div className="auto-error" role="alert">
                <X /> <span>{formError}</span>
              </div>
            )}

            <label className="field">
              <span className="field__label">Название</span>
              <input
                className="input"
                value={draft.name}
                maxLength={90}
                placeholder="Например, напоминание о съёмке"
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <div className="field">
              <span className="field__label">Канал</span>
              <div className="auto-toggle">
                {(data?.channels || [{ id: 'telegram' as const, label: 'Telegram' }]).map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className="auto-toggle__btn"
                    data-active={draft.channel === channel.id || undefined}
                    onClick={() => setDraft((prev) => ({ ...prev, channel: channel.id }))}
                  >
                    {channel.id === 'email' ? <Mail /> : <Send />}
                    {channel.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.channel === 'email' && (
              <label className="field">
                <span className="field__label">Тема письма</span>
                <input
                  className="input"
                  value={draft.subject}
                  maxLength={120}
                  placeholder="Ваши фотографии готовы"
                  onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                />
              </label>
            )}

            <label className="field">
              <span className="field__label">Текст сообщения</span>
              <textarea
                ref={bodyRef}
                className="textarea auto-textarea"
                rows={7}
                maxLength={2000}
                value={draft.body}
                placeholder="{{client_name}}, ждём вас {{date}} в {{time}}"
                onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
              />
              <span className="field__hint">{draft.body.length} / 2000 символов</span>
            </label>

            <div className="auto-vars">
              <span className="auto-vars__label">Вставить переменную</span>
              <div className="auto-vars__list">
                {(data?.variables || []).map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    className="auto-var"
                    title={variable.label}
                    onClick={() => insertVariable(variable.key)}
                  >
                    {'{{'}
                    {variable.key}
                    {'}}'}
                  </button>
                ))}
              </div>
            </div>

            <div className="auto-switch-row">
              <div>
                <b>Шаблон активен</b>
                <span>Выключенный шаблон не используют сценарии автоматизации</span>
              </div>
              <Switch
                checked={draft.isActive}
                label="Шаблон активен"
                onChange={(value) => setDraft((prev) => ({ ...prev, isActive: value }))}
              />
            </div>
          </div>

          <aside className="tpl-preview">
            <span className="tpl-preview__label">
              <Eye /> Предпросмотр
            </span>
            <div className="tpl-preview__bubble" data-channel={draft.channel}>
              {draft.channel === 'email' && preview?.subject && (
                <div className="tpl-preview__subject">{preview.subject}</div>
              )}
              <p>{preview?.body || draft.body || 'Текст появится здесь'}</p>
              <span className="tpl-preview__time">
                <Check /> так увидит клиент
              </span>
            </div>
          </aside>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Удалить шаблон?"
        message={
          <>
            Шаблон «{confirmDelete?.name}» исчезнет из списка. Сценарии, которые его использовали, перестанут отправлять
            сообщение.
          </>
        }
        confirmLabel="Удалить шаблон"
        busy={deleting}
        icon={<Trash2 />}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
