import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Send, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ClientDashboard({ params }: { params: { linkId: string } }) {
  // Имитация данных конкретной записи (в реальности берем из БД по linkId)
  const isBookingView = params.linkId.startsWith('bk_');

  if (isBookingView) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8">
        {/* Шапка записи */}
        <div className="bg-card border-b p-6 pt-12 text-center relative overflow-hidden">
          <Badge className="absolute top-6 left-1/2 -translate-x-1/2 mb-4 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">
            Ожидает подтверждения
          </Badge>
          <h1 className="text-2xl font-bold mt-8">Индивидуальная съемка</h1>
          <p className="text-muted-foreground mt-2">Код записи: #{params.linkId.split('_')[1] || '1203'}</p>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
          {/* Детали */}
          <div className="bg-card border rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Дата</div>
                <div className="font-semibold">24 Октября, Вторник</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Время</div>
                <div className="font-semibold">14:00 (60 мин)</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Локация</div>
                <div className="font-semibold">Студия X (Центр)</div>
              </div>
            </div>
          </div>

          {/* Финансы */}
          <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold mb-2">Стоимость</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Базовая стоимость</span>
              <span>5 000 ₽</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Студия X</span>
              <span>+2 000 ₽</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Скидка клиента (10%)</span>
              <span>-700 ₽</span>
            </div>
            <div className="pt-3 border-t flex justify-between font-bold text-lg">
              <span>Итого</span>
              <span>6 300 ₽</span>
            </div>
          </div>

          {/* Действия */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full h-12 rounded-xl">Перенести</Button>
            <Button variant="destructive" className="w-full h-12 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">Отменить</Button>
          </div>

          {/* Чат (Заглушка) */}
          <div className="bg-card border rounded-2xl flex flex-col shadow-sm h-[400px]">
            <div className="p-4 border-b font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> Чат с фотографом
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/30">
              <div className="flex flex-col gap-1 items-start">
                <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-2 text-sm shadow-sm">
                  Здравствуйте! Я получил вашу заявку. Вы уже придумали образы?
                </div>
                <span className="text-xs text-muted-foreground ml-1">10:42</span>
              </div>
              
              <div className="flex flex-col gap-1 items-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm shadow-sm">
                  Добрый день! Да, хочу что-то в строгом стиле.
                </div>
                <span className="text-xs text-muted-foreground mr-1">10:45</span>
              </div>
            </div>

            <div className="p-3 border-t flex gap-2 bg-card rounded-b-2xl">
              <Input placeholder="Написать сообщение..." className="rounded-xl bg-muted/50 border-transparent focus-visible:ring-primary/50" />
              <Button size="icon" className="rounded-xl shrink-0"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Дефолтный вид PWA-кабинета
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-8 pb-24">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
          И
        </div>
        <div>
          <h1 className="text-2xl font-bold">Иван Иванов</h1>
          <p className="text-muted-foreground">ID: {params.linkId}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-6 border rounded-2xl bg-card shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Баллы лояльности</h2>
          <div className="text-4xl font-bold text-primary">
            1 250
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="secondary">Постоянный</Badge>
            <span className="text-sm text-muted-foreground">Скидка 10%</span>
          </div>
        </div>

        <div className="p-6 border rounded-2xl bg-card shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Ваши записи</h2>
          <div className="space-y-3">
            <a href={`/${params.linkId}?view=bk_1203`} className="block p-3 rounded-xl bg-muted/50 hover:bg-muted transition flex justify-between items-center">
              <div>
                <div className="font-medium">Индивидуальная съемка</div>
                <div className="text-sm text-muted-foreground">24 Окт, 14:00</div>
              </div>
              <Badge className="bg-yellow-500/10 text-yellow-600 border-none hover:bg-yellow-500/20">Ожидает</Badge>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}