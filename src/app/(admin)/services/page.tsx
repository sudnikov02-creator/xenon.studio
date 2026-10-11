"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, MoreVertical, EyeOff, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const mockServices = [
  { id: "s1", name: "Индивидуальная съемка", price: 5000, strikePrice: 7000, duration: 60, isHidden: false, addonsCount: 2 },
  { id: "s2", name: "Love Story", price: 7000, strikePrice: null, duration: 90, isHidden: false, addonsCount: 1 },
  { id: "s3", name: "Семейная фотосессия", price: 8500, strikePrice: null, duration: 120, isHidden: false, addonsCount: 3 },
  { id: "s4", name: "Репортаж (Секретная)", price: 4000, strikePrice: null, duration: 60, isHidden: true, addonsCount: 0 },
];

export default function ServicesPage() {
  const services = mockServices;

  return (
    <div className="h-full flex flex-col p-6 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Услуги и Цены</h1>
          <p className="text-muted-foreground text-sm mt-1">Управляйте вашими услугами, допами и наценками</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Добавить услугу
        </Button>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <Card 
            key={service.id} 
            className={cn(
              "p-4 flex items-center gap-4 transition-all hover:border-primary/50 group",
              service.isHidden && "opacity-75 bg-muted/30"
            )}
          >
            <div className="cursor-grab text-muted-foreground/50 hover:text-foreground">
              <GripVertical className="w-5 h-5" />
            </div>
            
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Camera className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{service.name}</h3>
                {service.isHidden && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <EyeOff className="w-3 h-3" /> Скрытая
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                <span>{service.duration} мин</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                <span>Допов: {service.addonsCount}</span>
              </div>
            </div>

            <div className="text-right shrink-0 px-4">
              <div className="font-bold text-lg">
                {service.price.toLocaleString("ru-RU")} ₽
              </div>
              {service.strikePrice && (
                <div className="text-sm text-muted-foreground line-through">
                  {service.strikePrice.toLocaleString("ru-RU")} ₽
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}