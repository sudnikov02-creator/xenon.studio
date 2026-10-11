"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Star, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const mockClients = [
  { id: "c1", name: "Иван Иванов", phone: "+7 999 123-45-67", telegram: "@ivan_iv", ltv: 12500, points: 1250, level: "Постоянный", lastVisit: "24.10.2023", bookingsCount: 3, tags: ["Студия", "Портрет"] },
  { id: "c2", name: "Анна Смирнова", phone: "+7 900 000-00-00", telegram: "@anna_sm", ltv: 35000, points: 5000, level: "VIP", lastVisit: "15.10.2023", bookingsCount: 7, tags: ["Свадьба", "LoveStory"] },
  { id: "c3", name: "Михаил", phone: "+7 911 111-11-11", telegram: null, ltv: 0, points: 0, level: "Новичок", lastVisit: "Нет", bookingsCount: 0, tags: ["Опоздал"] },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="h-full flex flex-col p-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Клиенты (CRM)</h1>
          <p className="text-muted-foreground text-sm mt-1">Вся ваша база: контакты, LTV и программа лояльности</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Экспорт CSV
          </Button>
          <Button className="gap-2 bg-primary">
            Создать клиента
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по имени, телефону или TG..." 
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2 bg-card">
          <Filter className="w-4 h-4" /> Фильтры
        </Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden flex-1 flex flex-col">
        {/* Шапка таблицы */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b font-medium text-sm text-muted-foreground bg-muted/30">
          <div className="col-span-3">Клиент</div>
          <div className="col-span-2">Контакты</div>
          <div className="col-span-2">Лояльность</div>
          <div className="col-span-2">Статистика</div>
          <div className="col-span-3">Теги</div>
        </div>

        {/* Тело таблицы */}
        <div className="flex-1 overflow-y-auto">
          {mockClients.map((client) => (
            <div key={client.id} className="grid grid-cols-12 gap-4 p-4 border-b hover:bg-muted/30 transition-colors items-center cursor-pointer group">
              
              {/* Клиент */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold group-hover:text-primary transition-colors">{client.name}</div>
                  <div className="text-xs text-muted-foreground">ID: {client.id}</div>
                </div>
              </div>

              {/* Контакты */}
              <div className="col-span-2 text-sm">
                <div>{client.phone}</div>
                <div className="text-muted-foreground">{client.telegram || '—'}</div>
              </div>

              {/* Лояльность */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5 mb-1">
                  {client.level === 'VIP' && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                  {client.level === 'Постоянный' && <Star className="w-3.5 h-3.5 text-blue-500" />}
                  <span className="text-sm font-medium">{client.level}</span>
                </div>
                <div className="text-xs text-muted-foreground">{client.points} баллов</div>
              </div>

              {/* Статистика */}
              <div className="col-span-2 text-sm">
                <div className="font-semibold">{client.ltv > 0 ? `${client.ltv.toLocaleString("ru-RU")} ₽` : '0 ₽'}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" /> {client.bookingsCount} записей
                </div>
              </div>

              {/* Теги */}
              <div className="col-span-3 flex flex-wrap gap-1.5">
                {client.tags.map((tag, i) => (
                  <Badge 
                    key={i} 
                    variant="outline" 
                    className={cn(
                      "text-xs font-normal",
                      tag === 'Опоздал' && "border-red-500/30 bg-red-500/10 text-red-600"
                    )}
                  >
                    {tag === 'Опоздал' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {tag}
                  </Badge>
                ))}
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}