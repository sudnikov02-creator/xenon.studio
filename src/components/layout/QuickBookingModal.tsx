import { CalendarPlus, Check, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';

const FIELDS = ['Клиент и контакты', 'Услуга или пакет', 'Дата и время', 'Дополнения и цена', 'Заметка для студии'];

export function QuickBookingModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Быстрая запись"
      subtitle="Создание сессии за клиента"
      icon={<CalendarPlus />}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Закрыть
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onClose();
              navigate('/admin/bookings');
            }}
          >
            Открыть записи
          </button>
        </>
      }
    >
      <div style={{ padding: '22px 24px 26px' }}>
        <div
          style={{
            padding: '18px 18px 20px',
            borderRadius: 16,
            border: '1px solid var(--line)',
            background:
              'radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 55%), var(--surface-2)'
          }}
        >
          <div className="preview__chip" style={{ marginBottom: 12 }}>
            <CalendarPlus /> Следующий шаг
          </div>
          <h3 style={{ fontSize: 17, letterSpacing: '-0.025em' }}>Запись в два касания</h3>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8 }}>
            Быстрая запись откроется как полноэкранное окно поверх панели — без перехода на отдельную страницу.
            Она появится вместе с разделом «Записи».
          </p>
          <div className="preview__list" style={{ marginTop: 16 }}>
            {FIELDS.map((field) => (
              <div className="preview__item" key={field} style={{ fontSize: 13 }}>
                <span className="preview__item-icon">
                  <Check />
                </span>
                {field}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 13,
            border: '1px dashed var(--line-strong)',
            background: 'var(--surface)',
            fontSize: 12.5,
            color: 'var(--muted)'
          }}
        >
          <UserPlus style={{ width: 16, height: 16, color: 'var(--accent)', flex: 'none' }} />
          Новый клиент создаётся автоматически — его карточка появится в разделе «Клиенты».
        </div>
      </div>
    </Modal>
  );
}
