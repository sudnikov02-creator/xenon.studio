import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookingState {
  step: number;
  serviceId: string | null;
  locationId: string | null;
  selectedDate: string | null; // ISO string YYYY-MM-DD
  selectedTime: string | null; // HH:mm
  clientData: {
    name: string;
    phone: string;
    telegram: string;
  };
  
  setStep: (step: number) => void;
  setService: (id: string) => void;
  setLocation: (id: string | null) => void;
  setDateTime: (date: string, time: string) => void;
  setClientData: (data: Partial<BookingState['clientData']>) => void;
  resetForm: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      step: 0,
      serviceId: null,
      locationId: null,
      selectedDate: null,
      selectedTime: null,
      clientData: {
        name: '',
        phone: '',
        telegram: '',
      },

      setStep: (step) => set({ step }),
      setService: (id) => set({ serviceId: id }),
      setLocation: (id) => set({ locationId: id }),
      setDateTime: (date, time) => set({ selectedDate: date, selectedTime: time }),
      setClientData: (data) => set((state) => ({ 
        clientData: { ...state.clientData, ...data } 
      })),
      resetForm: () => set({
        step: 0,
        serviceId: null,
        locationId: null,
        selectedDate: null,
        selectedTime: null,
        clientData: { name: '', phone: '', telegram: '' }
      }),
    }),
    {
      name: 'booking-draft',
      partialize: (state) => ({
        // Сохраняем всё, кроме текущего шага, чтобы при обновлении человек мог продолжить с того же места или хотя бы данные не терялись
        serviceId: state.serviceId,
        locationId: state.locationId,
        selectedDate: state.selectedDate,
        selectedTime: state.selectedTime,
        clientData: state.clientData,
      }),
    }
  )
);
