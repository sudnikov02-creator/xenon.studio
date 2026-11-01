import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiError, api } from '../../lib/api';
import { formatLongDate } from '../../lib/booking';
import type { ClientBookingView } from '../../types';

const REASONS = ['Планы изменились', 'Заболел(а)', 'Не смогу приехать', 'Нашёл(ла) другого фотографа'];

export function ClientCancelModal({
  view,
  open,
  onClose,
  onDone
}: {
  view: ClientBookingView;
  open: boolean;
  onClose: () => void;
  onDone: (next: ClientBookingView) => void;
}) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setComment('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const text = [reason, comment.trim()].filter(Boolean).join(' · ');
      const next = await api.post<ClientBookingView>(`/public/bookings/${view.code}/cancel`, { reason: text });
      onDone(next);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отменить запись');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Отменить съёмку"
      subtitle={`${formatLongDate(view.booking.localDate)} в ${view.booking.localTime}`}
      icon={<XCircle />}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Оставить запись
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--danger${saving ? ' btn--loading' : ''}`}
            onClick={() => void submit()}
            disabled={saving}
          >
            Отменить съёмку
          </button>
        </>
      }
    >
      <div className="cc">
        <p className="cc__warn">
          Отмена освободит время для других клиентов. Если планы ещё не окончательные — лучше перенести
          съёмку.
        </p>

        <div className="field">
          <span className="field__label">Причина (необязательно)</span>
          <div className="cc__reasons">
            {REASONS.map((item) => (
              <button
                key={item}
                type="button"
                className="cc__reason"
                data-active={reason === item || undefined}
                onClick={() => setReason(reason === item ? '' : item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Комментарий фотографу</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={600}
            value={comment}
            placeholder="Например: заболел, давай перенесём на следующую неделю"
            onChange={(event) => setComment(event.target.value)}
          />
        </label>

        {error && <div className="cc__error">{error}</div>}
      </div>
    </Modal>
  );
}
