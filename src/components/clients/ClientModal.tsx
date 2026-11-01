import { useEffect, useState } from 'react';
import { AlertCircle, Camera, Mail, Phone, Send, User, UserPlus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { ClientDraft, ClientItem } from '../../types';

const EMPTY: ClientDraft = { name: '', phone: '', email: '', telegram: '', instagram: '', notes: '', tags: [] };

export function ClientModal({
  open,
  client,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  client: ClientItem | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: ClientDraft) => void;
}) {
  const [draft, setDraft] = useState<ClientDraft>(EMPTY);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setTagInput('');
    setDraft(
      client
        ? {
            name: client.name,
            phone: client.phone || '',
            email: client.email || '',
            telegram: client.telegram || '',
            instagram: client.instagram || '',
            notes: client.notes || '',
            tags: client.tags
          }
        : EMPTY
    );
  }, [open, client]);

  const set = <K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || draft.tags.includes(value)) return;
    set('tags', [...draft.tags, value].slice(0, 8));
    setTagInput('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Данные клиента' : 'Новый клиент'}
      subtitle={client ? `${client.bookings} записей · ${client.segment === 'vip' ? 'VIP' : 'обычный'}` : 'Добавьте клиента вручную'}
      icon={<UserPlus />}
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
            onClick={() => onSubmit({ ...draft, name: draft.name.trim() })}
            disabled={saving || !draft.name.trim()}
          >
            {client ? 'Сохранить' : 'Добавить клиента'}
          </button>
        </>
      }
    >
      <div className="cl-form">
        {error && (
          <div className="cl-form__error" role="alert">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <label className="field">
          <span className="field__label">Имя и фамилия</span>
          <span className="input-wrap">
            <User />
            <input
              className="input"
              value={draft.name}
              maxLength={80}
              placeholder="Анна Ковалёва"
              onChange={(event) => set('name', event.target.value)}
            />
          </span>
        </label>

        <div className="cl-form__row">
          <label className="field">
            <span className="field__label">Телефон</span>
            <span className="input-wrap">
              <Phone />
              <input
                className="input"
                value={draft.phone}
                placeholder="+375 29 000-00-00"
                onChange={(event) => set('phone', event.target.value)}
              />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <span className="input-wrap">
              <Mail />
              <input
                className="input"
                type="email"
                value={draft.email}
                placeholder="client@mail.ru"
                onChange={(event) => set('email', event.target.value)}
              />
            </span>
          </label>
        </div>

        <div className="cl-form__row">
          <label className="field">
            <span className="field__label">Telegram</span>
            <span className="input-wrap">
              <Send />
              <input
                className="input"
                value={draft.telegram}
                placeholder="anna_kov"
                onChange={(event) => set('telegram', event.target.value)}
              />
            </span>
          </label>
          <label className="field">
            <span className="field__label">Instagram</span>
            <span className="input-wrap">
              <Camera />
              <input
                className="input"
                value={draft.instagram}
                placeholder="anna.kov"
                onChange={(event) => set('instagram', event.target.value)}
              />
            </span>
          </label>
        </div>

        <div className="field">
          <span className="field__label">Метки</span>
          <div className="cl-tags">
            {draft.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="cl-tag"
                onClick={() => set('tags', draft.tags.filter((item) => item !== tag))}
              >
                {tag} <span aria-hidden>×</span>
              </button>
            ))}
            <input
              className="cl-tags__input"
              value={tagInput}
              maxLength={24}
              placeholder="Добавить метку"
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
            />
          </div>
        </div>

        <label className="field">
          <span className="field__label">Заметка</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={2000}
            value={draft.notes}
            placeholder="Что важно помнить: пожелания, аллергии, любимые ракурсы"
            onChange={(event) => set('notes', event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
