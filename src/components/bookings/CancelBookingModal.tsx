import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { BookingSummary } from '../../types';

export function CancelBookingModal({
  booking,
  open,
  busy,
  onClose,
  onSubmit
}: {
  booking: BookingSummary | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (open) setComment('');
  }, [open, booking?.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Отменить запись"
      subtitle={booking ? `${booking.client?.name || 'Клиент'} · ${booking.localDate}` : ''}
      icon={<XCircle />}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Не отменять
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--danger${busy ? ' btn--loading' : ''}`}
            onClick={() => onSubmit(comment.trim())}
            disabled={busy}
          >
            Отменить запись
          </button>
        </>
      }
    >
      <div className="cancel-body">
        <p>
          Запись получит статус «Отклонена» и исчезнет из активных. История и клиент сохранятся — запись
          можно вернуть сменой статуса.
        </p>
        <label className="field">
          <span className="field__label">Причина для себя (необязательно)</span>
          <textarea
            className="textarea"
            rows={3}
            maxLength={600}
            value={comment}
            placeholder="Например: клиент заболел, предложил перенести на следующую неделю"
            onChange={(event) => setComment(event.target.value)}
          />
          <span className="cancel-body__counter">{comment.length}/600</span>
        </label>
      </div>
    </Modal>
  );
}
