import { useEffect, useState } from 'react';
import { AlertCircle, Dices, Gift, Ticket } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import type { CertificateItem, Service } from '../../types';

interface Draft {
  code: string;
  kind: 'amount' | 'service';
  amount: string;
  serviceId: string;
  recipient: string;
  phone: string;
  email: string;
  purchasedAt: string;
  expiresAt: string;
  note: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

const EMPTY: Draft = {
  code: '',
  kind: 'amount',
  amount: '5000',
  serviceId: '',
  recipient: '',
  phone: '',
  email: '',
  purchasedAt: '',
  expiresAt: '',
  note: ''
};

export function CertificateModal({
  open,
  certificate,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  certificate: CertificateItem | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [services, setServices] = useState<Service[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ services: Service[] }>('/services')
      .then((data) => setServices(data.services.filter((item) => item.isActive)))
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDraft(
      certificate
        ? {
            code: certificate.code,
            kind: certificate.kind,
            amount: String(certificate.amount),
            serviceId: certificate.serviceId ? String(certificate.serviceId) : '',
            recipient: certificate.recipient || '',
            phone: certificate.phone || '',
            email: certificate.email || '',
            purchasedAt: certificate.purchasedAt || todayKey(),
            expiresAt: certificate.expiresAt || plusYear(),
            note: certificate.note || ''
          }
        : { ...EMPTY, purchasedAt: todayKey(), expiresAt: plusYear() }
    );
  }, [open, certificate]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const generate = async () => {
    setGenerating(true);
    try {
      const data = await api.get<{ code: string }>('/marketing/certificates/code');
      set('code', data.code);
    } catch {
      /* оставляем ручной ввод */
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={certificate ? 'Настройка сертификата' : 'Новый сертификат'}
      subtitle="Подарочный сертификат можно оплатить деньгами или съёмкой — клиент вводит код при записи"
      icon={<Gift />}
      size="medium"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            disabled={saving || (draft.kind === 'amount' ? Number(draft.amount) <= 0 : !draft.serviceId)}
            onClick={() =>
              onSubmit({
                code: draft.code.trim().toUpperCase() || undefined,
                kind: draft.kind,
                amount: Number(draft.amount) || 0,
                serviceId: draft.serviceId ? Number(draft.serviceId) : null,
                recipient: draft.recipient,
                phone: draft.phone,
                email: draft.email,
                purchasedAt: draft.purchasedAt || null,
                expiresAt: draft.expiresAt || null,
                note: draft.note
              })
            }
          >
            {certificate ? 'Сохранить' : 'Выпустить сертификат'}
          </button>
        </>
      }
    >
      <div className="mk-form">
        {error && (
          <div className="cl-form__error" role="alert">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="field">
          <span className="field__label">Что дарит сертификат</span>
          <div className="mk-toggle">
            <button
              type="button"
              className="mk-toggle__btn"
              data-active={draft.kind === 'amount' || undefined}
              onClick={() => set('kind', 'amount')}
            >
              <Ticket /> Сумма
            </button>
            <button
              type="button"
              className="mk-toggle__btn"
              data-active={draft.kind === 'service' || undefined}
              onClick={() => set('kind', 'service')}
            >
              <Gift /> Услуга
            </button>
          </div>
        </div>

        <div className="mk-form__row">
          {draft.kind === 'amount' ? (
            <label className="field">
              <span className="field__label">Номинал</span>
              <input
                className="input"
                type="number"
                min={0}
                step={500}
                value={draft.amount}
                onChange={(event) => set('amount', event.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              <span className="field__label">Услуга</span>
              <select className="select" value={draft.serviceId} onChange={(event) => set('serviceId', event.target.value)}>
                <option value="">Выберите услугу</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field__label">Код</span>
            <span className="mk-code-field">
              <input
                className="input mk-code-field__input"
                value={draft.code}
                maxLength={24}
                placeholder="сгенерируется сам"
                onChange={(event) => set('code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              />
              <button type="button" className={`btn btn--bordered${generating ? ' btn--loading' : ''}`} onClick={() => void generate()}>
                <Dices />
              </button>
            </span>
          </label>
        </div>

        <label className="field">
          <span className="field__label">Кому</span>
          <input
            className="input"
            value={draft.recipient}
            maxLength={90}
            placeholder="Имя получателя"
            onChange={(event) => set('recipient', event.target.value)}
          />
        </label>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Телефон</span>
            <input
              className="input"
              value={draft.phone}
              placeholder="+375 29 000-00-00"
              onChange={(event) => set('phone', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={draft.email}
              placeholder="mail@example.com"
              onChange={(event) => set('email', event.target.value)}
            />
          </label>
        </div>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Дата покупки</span>
            <input
              className="input"
              type="date"
              value={draft.purchasedAt}
              onChange={(event) => set('purchasedAt', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Действует до</span>
            <input
              className="input"
              type="date"
              value={draft.expiresAt}
              onChange={(event) => set('expiresAt', event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Заметка</span>
          <input
            className="input"
            value={draft.note}
            maxLength={300}
            placeholder="Повод, кто подарил"
            onChange={(event) => set('note', event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
