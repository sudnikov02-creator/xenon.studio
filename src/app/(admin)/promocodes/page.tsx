"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Search, MoreVertical, Clock, Percent, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

const mockPromos = [
  { id: "p1", code: "SUMMER2024", type: "PERCENTAGE", value: 15, used: 24, limit: 50, expiresAt: "31.08.2024", isActive: true },
  { id: "p2", code: "WELCOME", type: "FIXED", value: 1000, used: 112, limit: null, expiresAt: null, isActive: true },
  { id: "p3", code: "BLACKFRIDAY", type: "PERCENTAGE", value: 30, used: 100, limit: 100, expiresAt: "26.11.2023", isActive: false },
];

export default function PromocodesPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="h-full flex flex-col p-6 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Промокоды</h1>
          <p className="text-muted-foreground text-sm mt-1">Управление скидками и маркетинговыми акциями</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Создать промокод
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по коду..." 
            className="pl-9 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockPromos.map((promo) => (
          <Card 
            key={promo.id} 
            className={cn(
              "p-5 flex flex-col relative overflow-hidden transition-all hover:border-primary/50",
              !promo.isActive && "opacity-75 bg-muted/30"
            )}
          >
            {/* Декоративный уголок */}
            <div className={cn(
              "absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rotate-45",
              promo.isActive ? "bg-primary/10" : "bg-muted-foreground/10"
            )} />

            <div className="flex justify-between items-start mb-4 relative">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  promo.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight font-mono">{promo.code}</h3>
                  <Badge variant={promo.isActive ? "default" : "secondary"} className="mt-1">
                    {promo.isActive ? "Активен" : "Неактивен"}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="mt-auto pt-4 border-t space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {promo.type === 'PERCENTAGE' ? <Percent className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                  Скидка
                </span>
                <span className="font-semibold text-lg">
                  {promo.type === 'PERCENTAGE' ? `${promo.value}%` : `${promo.value.toLocaleString('ru-RU')} ₽`}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Использовано
                </span>
                <span className="font-medium">
                  {promo.used} {promo.limit ? `/ ${promo.limit}` : '(без лимита)'}
                </span>
              </div>

              {promo.expiresAt && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Истекает
                  </span>
                  <span className={cn(
                    "font-medium",
                    !promo.isActive && "text-destructive"
                  )}>
                    {promo.expiresAt}
                  </span>
                </div>
              )}
            </div>
            
            {/* Progress bar for limits */}
            {promo.limit && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                <div 
                  className={cn("h-full transition-all", promo.isActive ? "bg-primary" : "bg-muted-foreground")} 
                  style={{ width: `${Math.min((promo.used / promo.limit) * 100, 100)}%` }}
                />
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}