import { CalendarPlus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BookingWizard } from '../booking/BookingWizard';

export function QuickBookingModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая запись"
      subtitle="Создание сессии за клиента — статус «Заявка»"
      icon={<CalendarPlus />}
      size="wide"
      className="overlay--booking"
    >
      <div className="quick-booking">
        <BookingWizard variant="admin" onClose={onClose} />
      </div>
    </Modal>
  );
}
