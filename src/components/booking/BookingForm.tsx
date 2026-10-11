"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ArrowLeft, CheckCircle2, User, MapPin, Calendar as CalendarIcon, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBookingStore } from "@/store/useBookingStore";
import { useToast } from "@/components/ui/use-toast";
import { getServices, getLocations, getAvailableSlots } from "@/app/actions/booking";
import { format, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

const steps = [
  { id: "service", label: "Услуга" },
  { id: "location", label: "Локация" },
  { id: "datetime", label: "Дата и время" },
  { id: "details", label: "Ваши данные" },
  { id: "confirm", label: "Подтверждение" }
];

export function BookingForm() {
  const { step, setStep, resetForm, clientData } = useBookingStore();
  const { toast } = useToast();
  
  const progressValue = ((step + 1) / steps.length) * 100;
  
  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };
  
  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleConfirm = () => {
    toast({
      title: "Заявка отправлена!",
      description: "Перейдите в Telegram для получения кода верификации.",
    });
    // Здесь отправка данных в API
    setTimeout(() => {
      resetForm();
    }, 2000);
  };

  // Покажем индикатор восстановления черновика
  useEffect(() => {
    if (clientData.name || clientData.phone) {
      toast({
        title: "Черновик восстановлен",
        description: "Мы сохранили ваши данные с прошлого визита.",
        duration: 3000,
        action: <Save className="w-4 h-4" />
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-center">Запись на съемку</h2>
        <div className="mt-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-3 font-medium">
            <span>{steps[step].label}</span>
            <span>Шаг {step + 1} из {steps.length}</span>
          </div>
          <Progress value={progressValue} className="h-2.5" />
        </div>
      </div>

      <Card className="overflow-hidden border-muted">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="p-6 sm:p-8 min-h-[400px] flex flex-col"
          >
            {step === 0 && <StepService onNext={handleNext} />}
            {step === 1 && <StepLocation onNext={handleNext} />}
            {step === 2 && <StepDateTime onNext={handleNext} />}
            {step === 3 && <StepDetails />}
            {step === 4 && <StepConfirm />}
          </motion.div>
        </AnimatePresence>
      </Card>

      <div className="flex justify-between items-center">
        <Button 
          variant="outline" 
          onClick={handlePrev} 
          disabled={step === 0}
          className="gap-2 w-[120px]"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </Button>
        
        {step < steps.length - 1 ? (
          <Button onClick={handleNext} className="gap-2 w-[120px]">
            Далее <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleConfirm} className="gap-2 w-[180px] bg-primary text-primary-foreground">
            Подтвердить <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StepService({ onNext }: { onNext: () => void }) {
  const { serviceId, setService } = useBookingStore();
  const [services, setServices] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getServices().then(setServices);
  }, []);

  return (
    <div className="space-y-6 flex-1">
      <h3 className="text-xl font-semibold">Выберите услугу</h3>
      <div className="grid gap-3">
        {services.length === 0 ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}
          </div>
        ) : (
          services.map((s) => (
            <div 
              key={s.id} 
              onClick={() => { setService(s.id); setTimeout(onNext, 200); }}
              className={cn(
                "p-4 border rounded-xl cursor-pointer transition-all duration-300 flex justify-between items-center group",
                serviceId === s.id ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/50"
              )}
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.duration} мин</div>
              </div>
              <span className="font-semibold">{s.basePrice} ₽</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StepLocation({ onNext }: { onNext: () => void }) {
  const { locationId, setLocation } = useBookingStore();
  const [locations, setLocations] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    getLocations().then(setLocations);
  }, []);

  return (
    <div className="space-y-6 flex-1">
      <h3 className="text-xl font-semibold flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Выберите локацию</h3>
      <div className="grid gap-3">
        <div 
          onClick={() => { setLocation(null); setTimeout(onNext, 200); }}
          className={cn(
            "p-4 border rounded-xl cursor-pointer transition-all duration-300 flex justify-between items-center",
            locationId === null ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/50"
          )}
        >
          <span className="font-medium">Без локации (обсуждается индивидуально)</span>
        </div>
        
        {locations.map((l) => (
          <div 
            key={l.id} 
            onClick={() => { setLocation(l.id); setTimeout(onNext, 200); }}
            className={cn(
              "p-4 border rounded-xl cursor-pointer transition-all duration-300 flex justify-between items-center",
              locationId === l.id ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-primary/50"
            )}
          >
            <span className="font-medium">{l.name}</span>
            {l.priceModifier > 0 && <span className="text-sm text-muted-foreground">+{l.priceModifier} ₽</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepDateTime({ onNext }: { onNext: () => void }) {
  const { selectedDate, selectedTime, setDateTime } = useBookingStore();
  const [slots, setSlots] = useState<string[]>([]);
  
  // Генерация ближайших 14 дней
  const today = new Date();
  const days = Array.from({ length: 14 }).map((_, i) => addDays(today, i));

  useEffect(() => {
    if (selectedDate) {
      setSlots([]); // clear while loading
      getAvailableSlots(selectedDate).then(setSlots);
    }
  }, [selectedDate]);

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <h3 className="text-xl font-semibold flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary"/> Выберите дату и время</h3>
      
      <div className="space-y-4 flex-1">
        <div className="text-sm font-medium text-muted-foreground">Доступные даты</div>
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {days.map((d) => {
            const iso = format(d, 'yyyy-MM-dd');
            const isSelected = selectedDate === iso;
            return (
              <div
                key={iso}
                onClick={() => setDateTime(iso, '')}
                className={cn(
                  "snap-start shrink-0 flex flex-col items-center justify-center min-w-[72px] h-[84px] rounded-2xl border cursor-pointer transition-all duration-300",
                  isSelected 
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" 
                    : "bg-card hover:border-primary/50"
                )}
              >
                <span className="text-xs uppercase opacity-80">{format(d, 'eee', { locale: ru })}</span>
                <span className="text-2xl font-bold mt-1">{format(d, 'd')}</span>
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout">
          {selectedDate && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="text-sm font-medium text-muted-foreground mt-4">Время</div>
              {slots.length === 0 ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {slots.map(time => (
                    <div
                      key={time}
                      onClick={() => { setDateTime(selectedDate, time); setTimeout(onNext, 300); }}
                      className={cn(
                        "py-3 rounded-xl border text-center cursor-pointer transition-all duration-300 font-medium",
                        selectedTime === time 
                          ? "bg-primary text-primary-foreground border-primary shadow" 
                          : "hover:border-primary/50 bg-card"
                      )}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepDetails() {
  const { clientData, setClientData } = useBookingStore();

  return (
    <div className="space-y-6 flex-1">
      <h3 className="text-xl font-semibold flex items-center gap-2"><User className="w-5 h-5 text-primary"/> Ваши данные</h3>
      <div className="space-y-5 mt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Имя и фамилия</label>
          <Input 
            placeholder="Иван Иванов" 
            value={clientData.name}
            onChange={(e) => setClientData({ name: e.target.value })}
            className="h-12 text-base rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Телефон</label>
          <Input 
            placeholder="+7 (999) 000-00-00" 
            type="tel"
            value={clientData.phone}
            onChange={(e) => setClientData({ phone: e.target.value })}
            className="h-12 text-base rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Telegram (опционально)</label>
          <Input 
            placeholder="@username" 
            value={clientData.telegram}
            onChange={(e) => setClientData({ telegram: e.target.value })}
            className="h-12 text-base rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}

function StepConfirm() {
  const { serviceId, locationId, selectedDate, selectedTime, clientData } = useBookingStore();

  return (
    <div className="space-y-6 flex-1 flex flex-col items-center justify-center py-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <CheckCircle2 className="w-20 h-20 text-primary mb-6" />
      </motion.div>
      <h3 className="text-2xl font-bold text-center">Все готово к записи</h3>
      
      <div className="w-full bg-muted/30 rounded-2xl p-5 space-y-3 text-sm">
        <div className="flex justify-between border-b pb-3">
          <span className="text-muted-foreground">Услуга</span>
          <span className="font-medium text-right">{serviceId ? 'Выбрана' : '—'}</span>
        </div>
        <div className="flex justify-between border-b pb-3">
          <span className="text-muted-foreground">Локация</span>
          <span className="font-medium text-right">{locationId ? 'Выбрана' : 'Без локации'}</span>
        </div>
        <div className="flex justify-between border-b pb-3">
          <span className="text-muted-foreground">Дата и время</span>
          <span className="font-medium text-right">{selectedDate} в {selectedTime}</span>
        </div>
        <div className="flex justify-between border-b pb-3">
          <span className="text-muted-foreground">Клиент</span>
          <span className="font-medium text-right">{clientData.name || 'Не указано'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Итого к оплате</span>
          <span className="font-bold text-lg">от 5 000 ₽</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-sm mt-4 leading-relaxed">
        После нажатия «Подтвердить» мы забронируем за вами это время. Telegram-бот пришлет вам код верификации для завершения.
      </p>
    </div>
  );
}
