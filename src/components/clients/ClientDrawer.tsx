import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarDays,
  Camera,
  Check,
  Coins,
  Copy,
  CreditCard,
  History,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ClientModal } from './ClientModal';
import { BookingStatusPill } from '../bookings/BookingStatusPill';
import { api, ApiError } from '../../lib/api';
import { dayMonthLabel, formatMoney, initials, plural } from '../../lib/utils';
import type { ClientDetailPayload, ClientDraft, ClientItem } from '../../types';

function dayKeyLabel(dateKey: string | null): string {
  if (!dateKey) return '—';
  return dayMonthLabel(dateKey).replace(/ (\d{4})$/, '');
}

export function ClientDrawer({
  clientId,
  currencySymbol,
  decimalSeparator,
  onClose,
  onChanged
}: {
  clientId: number | null;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ClientDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const open = clientId !== null;

  const load = useCallback(async (id: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<ClientDetailPayload>(`/clients/${id}`);
      setDetail(data);
      setNotes(data.client.notes || '');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось открыть клиента');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId === null) {
      setDetail(null);
      setError(null);
      return;
    }
    void load(clientId);
  }, [clientId, load]);

  const client = detail?.client || null;

  const patch = async (payload: Record<string, unknown>) => {
    if (!client) return;
    setBusy(true);
    setActionError(null);
    try {
      const data = await api.patch<ClientDetailPayload>(`/clients/${client.id}`, payload);
      setDetail(data);
      setNotes(data.client.notes || '');
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось сохранить изменения');
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    setActionError(null);
    try {
      await patch({ notes });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } finally {
      setSavingNotes(false);
    }
  };

  const submitEdit = async (draft: ClientDraft) => {
    if (!client) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const data = await api.patch<ClientDetailPayload>(`/clients/${client.id}`, draft);
      setDetail(data);
      setNotes(data.client.notes || '');
      setEditOpen(false);
      onChanged();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Не удалось сохранить клиента');
    } finally {
      setEditSaving(false);
    }
  };

  const remove = async () => {
    if (!client) return;
    setBusy(true);
    try {
      await api.del(`/clients/${client.id}`);
      setDeleteOpen(false);
      onClose();
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось удалить клиента');
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const metrics = useMemo(() => {
    if (!client || !detail) return [];
    return [
      { label: 'Съёмок', value: String(client.bookings), icon: <Camera /> },
      { label: 'Потрачено', value: formatMoney(client.spent, currencySymbol, decimalSeparator), icon: <CreditCard /> },
      { label: 'Средний чек', value: formatMoney(client.avgCheck, currencySymbol, decimalSeparator), icon: <Sparkles /> },
      {
        label: client.hasUpcoming ? 'Ближайшая' : 'Последняя',
        value: dayKeyLabel(client.nextVisitDate || client.lastVisitDate),
        icon: <CalendarDays />
      }
    ];
  }, [client, detail, currencySymbol, decimalSeparator]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="wide"
        className="overlay--drawer"
        title={client?.name || 'Клиент'}
        subtitle={
          client
            ? `${client.bookings} ${plural(client.bookings, 'съёмка', 'съёмки', 'съёмок')} · ${
                client.segment === 'vip' ? 'VIP' : client.segment === 'blacklist' ? 'чёрный список' : 'в базе'
              }`
            : undefined
        }
        icon={client ? <span className="bd-avatar">{initials(client.name)}</span> : <Camera />}
        footer={
          <div className="bd-foot">
            <button
              type="button"
              className="btn btn--ghost bd-delete"
              onClick={() => setDeleteOpen(true)}
              disabled={busy || !client || client.bookings > 0}
              title={client && client.bookings > 0 ? 'У клиента есть записи — удаление недоступно' : 'Удалить клиента'}
            >
              <Trash2 /> <span>Удалить</span>
            </button>
            <div className="spacer" />
            <button type="button" className="btn" onClick={() => setEditOpen(true)} disabled={!client}>
              <Pencil /> Изменить
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void patch({ isVip: !client?.isVip })}
              disabled={busy || !client}
            >
              <Star /> {client?.isVip ? 'Снять VIP' : 'Сделать VIP'}
            </button>
          </div>
        }
      >
        {loading && !detail && (
          <div className="bd-loading">
            <span className="skeleton" style={{ height: 66, borderRadius: 14 }} />
            <span className="skeleton" style={{ height: 120, borderRadius: 14, marginTop: 12 }} />
            <span className="skeleton" style={{ height: 160, borderRadius: 14, marginTop: 12 }} />
          </div>
        )}

        {error && !detail && (
          <div className="bd-error">
            <TriangleAlert />
            <div>
              <b>Не удалось открыть</b>
              <span>{error}</span>
            </div>
            {clientId !== null && (
              <button type="button" className="btn btn--sm" onClick={() => void load(clientId)}>
                Повторить
              </button>
            )}
          </div>
        )}

        {detail && client && (
          <div className="cl-detail">
            <div className="cl-metrics">
              {metrics.map((metric) => (
                <div className="cl-metric" key={metric.label}>
                  <span className="cl-metric__icon">{metric.icon}</span>
                  <div>
                    <em>{metric.label}</em>
                    <b className="tnum">{metric.value}</b>
                  </div>
                </div>
              ))}
            </div>

            {actionError && (
              <div className="bd__alert" role="alert">
                <TriangleAlert /> {actionError}
              </div>
            )}

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>Контакты</h4>
                {client.tags.length > 0 && <span>{client.tags.join(' · ')}</span>}
              </header>
              <div className="bd__contacts">
                {client.phone && (
                  <a className="bd-contact" href={`tel:${client.phone.replace(/[^\d+]/g, '')}`}>
                    <Phone />
                    <span>{client.phone}</span>
                  </a>
                )}
                {client.email && (
                  <a className="bd-contact" href={`mailto:${client.email}`}>
                    <Mail />
                    <span>{client.email}</span>
                  </a>
                )}
                {client.telegram && (
                  <a
                    className="bd-contact"
                    href={`https://t.me/${client.telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Send />
                    <span>@{client.telegram.replace('@', '')}</span>
                  </a>
                )}
                {client.instagram && (
                  <a
                    className="bd-contact"
                    href={`https://instagram.com/${client.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Camera />
                    <span>@{client.instagram.replace('@', '')}</span>
                  </a>
                )}
                {!client.phone && !client.email && !client.telegram && !client.instagram && (
                  <p className="bd-empty-note">Контактов пока нет — добавьте телефон или мессенджер.</p>
                )}
              </div>
            </section>

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>Статус клиента</h4>
                <span>Видно только вам</span>
              </header>
              <div className="cl-switches">
                <div className="cl-switch">
                  <span className="cl-switch__icon cl-switch__icon--vip">
                    <Star />
                  </span>
                  <div>
                    <b>VIP-клиент</b>
                    <em>Постоянный клиент, особое внимание</em>
                  </div>
                  <Switch
                    checked={client.isVip}
                    label="VIP-клиент"
                    disabled={busy}
                    onChange={(value) => void patch({ isVip: value })}
                  />
                </div>
                <div className="cl-switch">
                  <span className="cl-switch__icon cl-switch__icon--ban">
                    <Ban />
                  </span>
                  <div>
                    <b>Чёрный список</b>
                    <em>Не принимаем новые заявки от клиента</em>
                  </div>
                  <Switch
                    checked={client.isBlacklisted}
                    label="Чёрный список"
                    disabled={busy}
                    onChange={(value) => void patch({ isBlacklisted: value })}
                  />
                </div>
              </div>
            </section>

            {detail.loyalty && (
              <section className="bd__section">
                <header className="bd__section-head">
                  <h4>
                    <Coins /> Бонусы и рекомендации
                  </h4>
                  <span>{detail.loyalty.invited} приглашено</span>
                </header>
                <div className="cl-loyalty">
                  <div className="cl-loyalty__balance">
                    <b className="tnum">{detail.loyalty.balance}</b>
                    <span>баллов на счёте</span>
                  </div>
                  {detail.loyalty.refCode && (
                    <button
                      type="button"
                      className="cl-loyalty__link"
                      onClick={() => {
                        const link = `${window.location.origin}/booking?ref=${detail.loyalty?.refCode}`;
                        void navigator.clipboard?.writeText(link);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 1600);
                      }}
                    >
                      {copiedLink ? <Check /> : <Copy />}
                      {copiedLink ? 'Ссылка скопирована' : `Реферальная ссылка · ${detail.loyalty.refCode}`}
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>Заметка о клиенте</h4>
                <span>Помогает перед съёмкой</span>
              </header>
              <label className="field">
                <textarea
                  className="textarea"
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  placeholder="Пожелания, аллергии, любимые ракурсы, что подарить"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`btn btn--soft btn--sm bd__save${savingNotes ? ' btn--loading' : ''}`}
                onClick={() => void saveNotes()}
                disabled={savingNotes || notes === (client.notes || '')}
              >
                {savedFlash ? <Check /> : <MessageCircle />}
                {savedFlash ? 'Сохранено' : 'Сохранить заметку'}
              </button>
            </section>

            <section className="bd__section">
              <header className="bd__section-head">
                <h4>
                  <History /> История съёмок
                </h4>
                <span>
                  {detail.stats.total} {plural(detail.stats.total, 'запись', 'записи', 'записей')}
                  {detail.stats.cancelled > 0 ? ` · ${detail.stats.cancelled} отменено` : ''}
                </span>
              </header>

              {detail.bookings.length === 0 ? (
                <p className="bd-empty-note">Съёмок пока нет — клиент появится здесь после первой записи.</p>
              ) : (
                <ul className="cl-history">
                  {detail.bookings.map((item) => (
                    <li key={item.id} className="cl-history__row" data-cancelled={item.status?.isCancelled || undefined}>
                      <span className="cl-history__date tnum">{item.localDate.slice(8, 10)}</span>
                      <span className="cl-history__month">
                        {new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' })
                          .format(new Date(`${item.localDate}T00:00:00.000Z`))
                          .replace('.', '')}
                      </span>
                      <span className="cl-history__service">
                        <b>{item.service}</b>
                        <em>{item.localDate.slice(0, 4)}</em>
                      </span>
                      <span className="cl-history__price tnum">
                        {formatMoney(item.price, currencySymbol, decimalSeparator)}
                      </span>
                      <BookingStatusPill status={item.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      <ClientModal
        open={editOpen}
        client={client}
        saving={editSaving}
        error={editError}
        onClose={() => setEditOpen(false)}
        onSubmit={(draft) => void submitEdit(draft)}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Удалить клиента?"
        message={
          <span>
            Клиент «{client?.name}» исчезнет из базы. Записи удалить нельзя — если нужно просто скрыть клиента,
            добавьте его в чёрный список.
          </span>
        }
        confirmLabel="Удалить клиента"
        busy={busy}
        icon={<Trash2 />}
        onConfirm={() => void remove()}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
