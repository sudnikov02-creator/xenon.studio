"use client";

import { useState } from "react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockBookings = [
  { id: 1, title: "Love Story (Иван)", date: new Date(), time: "10:00", duration: 90, status: "Подтверждено", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { id: 2, title: "Индивидуальная", date: addDays(new Date(), 1), time: "14:00", duration: 60, status: "Ожидает", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const hours = Array.from({ length: 13 }).map((_, i) => i + 9); // 09:00 - 21:00

  return (
    <div className="h-full flex flex-col p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Календарь</h1>
          <div className="flex items-center bg-card border rounded-lg overflow-hidden">
            <Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 text-sm font-medium min-w-[120px] text-center">
              {format(startDate, 'd MMM', { locale: ru })} - {format(addDays(startDate, 6), 'd MMM', { locale: ru })}
            </div>
            <Button variant="ghost" size="icon" className="rounded-none h-9 w-9" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Новая запись
        </Button>
      </div>

      <div className="flex-1 bg-card border rounded-xl overflow-hidden flex flex-col">
        {/* Заголовок дней недели */}
        <div className="flex border-b">
          <div className="w-16 border-r shrink-0"></div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="flex-1 p-3 text-center border-r last:border-r-0">
              <div className="text-xs text-muted-foreground uppercase">{format(day, 'eee', { locale: ru })}</div>
              <div className="text-lg font-bold mt-1">{format(day, 'd')}</div>
            </div>
          ))}
        </div>

        {/* Сетка времени */}
        <div className="flex-1 overflow-y-auto relative">
          {hours.map(hour => (
            <div key={hour} className="flex border-b min-h-[80px]">
              <div className="w-16 border-r shrink-0 flex items-start justify-center pt-2">
                <span className="text-xs text-muted-foreground">{hour}:00</span>
              </div>
              {weekDays.map(day => (
                <div key={`${day.toISOString()}-${hour}`} className="flex-1 border-r last:border-r-0 relative hover:bg-muted/30 transition-colors">
                  {/* Отрисовка событий */}
                  {mockBookings.map(booking => {
                    const bDateStr = format(booking.date, 'yyyy-MM-dd');
                    const dDateStr = format(day, 'yyyy-MM-dd');
                    const bHour = parseInt(booking.time.split(':')[0]);
                    
                    if (bDateStr === dDateStr && bHour === hour) {
                      return (
                        <div 
                          key={booking.id} 
                          className={`absolute top-2 left-2 right-2 border rounded-lg p-2 text-xs shadow-sm cursor-pointer hover:shadow-md transition-shadow ${booking.color}`}
                        >
                          <div className="font-semibold truncate">{booking.time} • {booking.title}</div>
                          <div className="mt-1 opacity-80">{booking.status}</div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
