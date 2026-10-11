"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ArrowLeft, CheckCircle2, User, Clock, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

const steps = [
  { id: "service", label: "Услуга" },
  { id: "location", label: "Локация" },
  { id: "datetime", label: "Дата и время" },
  { id: "details", label: "Ваши данные" },
  { id: "confirm", label: "Подтверждение" }
];

export function BookingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  
  const progressValue = ((currentStep + 1) / steps.length) * 100;
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
  };
  
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-center">Запись на съемку</h2>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{steps[currentStep].label}</span>
            <span>Шаг {currentStep + 1} из {steps.length}</span>
          </div>
          <Progress value={progressValue} />
        </div>
      </div>

      {/* Content */}
      <Card className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-6 min-h-[300px] flex flex-col"
          >
            {currentStep === 0 && <StepService />}
            {currentStep === 1 && <StepLocation />}
            {currentStep === 2 && <StepDateTime />}
            {currentStep === 3 && <StepDetails />}
            {currentStep === 4 && <StepConfirm />}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button 
          variant="ghost" 
          onClick={handlePrev} 
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Назад
        </Button>
        
        {currentStep < steps.length - 1 ? (
          <Button onClick={handleNext} className="gap-2">
            Далее <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={() => alert("Запись подтверждена")} className="gap-2 bg-primary">
            Подтвердить <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Mock content for steps
function StepService() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Выберите услугу</h3>
      <div className="grid gap-3">
        {['Индивидуальная съемка', 'Love Story', 'Семейная'].map((s, i) => (
          <div key={i} className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors flex justify-between items-center">
            <span>{s}</span>
            <span className="text-muted-foreground">от 5 000 ₽</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepLocation() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><MapPin className="w-5 h-5"/> Выберите локацию</h3>
      <div className="grid gap-3">
        {['Студия X (Центр)', 'Уличная съемка', 'Фотостудия Y'].map((s, i) => (
          <div key={i} className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepDateTime() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5"/> Выберите время</h3>
      <div className="text-muted-foreground">Здесь будет календарь...</div>
    </div>
  );
}

function StepDetails() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2"><User className="w-5 h-5"/> Ваши данные</h3>
      <div className="space-y-4">
        <Input placeholder="Имя" />
        <Input placeholder="Телефон" type="tel" />
        <Input placeholder="Telegram @username" />
      </div>
    </div>
  );
}

function StepConfirm() {
  return (
    <div className="space-y-4 text-center py-8 flex flex-col items-center">
      <CheckCircle2 className="w-16 h-16 text-primary mb-4" />
      <h3 className="text-xl font-semibold">Все готово к записи</h3>
      <p className="text-muted-foreground max-w-xs mx-auto">
        Проверьте детали. После подтверждения вам придет код верификации в Telegram.
      </p>
    </div>
  );
}
