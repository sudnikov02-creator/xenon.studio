import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { QuickBookingModal } from '../components/layout/QuickBookingModal';

interface QuickBookingValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const QuickBookingContext = createContext<QuickBookingValue | null>(null);

export function QuickBookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <QuickBookingContext.Provider value={value}>
      {children}
      <QuickBookingModal open={isOpen} onClose={close} />
    </QuickBookingContext.Provider>
  );
}

export function useQuickBooking(): QuickBookingValue {
  const context = useContext(QuickBookingContext);
  if (!context) throw new Error('useQuickBooking must be used inside QuickBookingProvider');
  return context;
}
