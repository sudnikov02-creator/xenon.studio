"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { 
  Settings2, Calendar as CalIcon, Camera, CheckCircle, 
  FormInput, ShieldCheck, CreditCard, Bell, MessageSquare, 
  Star, Gift, Tags, Palette, Puzzle, Lock, Server 
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingSections = [
  { id: "general", label: "Общие", icon: Settings2 },
  { id: "calendar", label: "Календарь", icon: CalIcon },
  { id: "services", label: "Услуги и Цены", icon: Camera },
  { id: "statuses", label: "Статусы", icon: CheckCircle },
  { id: "form", label: "Форма записи", icon: FormInput },
  { id: "verification", label: "Верификация", icon: ShieldCheck },
  { id: "payment", label: "Оплата", icon: CreditCard },
  { id: "notifications", label: "Уведомления", icon: Bell },
  { id: "messenger", label: "Мессенджер", icon: MessageSquare },
  { id: "reviews", label: "Отзывы", icon: Star },
  { id: "loyalty", label: "Лояльность", icon: Gift },
  { id: "promo", label: "Промокоды", icon: Tags },
  { id: "appearance", label: "Внешний вид", icon: Palette },
  { id: "integrations", label: "Интеграции", icon: Puzzle },
  { id: "security", label: "Безопасность", icon: Lock },
  { id: "system", label: "Системное", icon: Server },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-full flex flex-col p-6 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <Button>Сохранить изменения</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
        
        {/* Боковое меню настроек */}
        <div className="w-full md:w-64 flex flex-col gap-1 overflow-y-auto pr-2 pb-12 shrink-0">
          {settingSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                activeTab === s.id 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Контент настроек */}
        <div className="flex-1 overflow-y-auto pb-12">
          
          {activeTab === "general" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-semibold mb-1">Общие настройки</h2>
                <p className="text-sm text-muted-foreground mb-6">Основная информация о вашем профиле и студии.</p>
              </div>
              
              <Card className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название студии / Имя фотографа</label>
                  <Input defaultValue="xenon.studio" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Контактный телефон</label>
                  <Input defaultValue="+7 (999) 123-45-67" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email для уведомлений</label>
                  <Input defaultValue="admin@xenon.studio" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Включить кабинет клиента</h3>
                    <p className="text-sm text-muted-foreground">Клиенты смогут заходить по уникальной ссылке.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Card>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-semibold mb-1">Внешний вид</h2>
                <p className="text-sm text-muted-foreground mb-6">Настройка темы и дизайна публичной страницы.</p>
              </div>
              
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Тема оформления</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setTheme("light")}
                      className={cn(
                        "p-4 border rounded-xl flex flex-col items-center gap-2 transition-all",
                        theme === "light" ? "border-primary bg-primary/5" : "hover:bg-muted"
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-white border shadow-sm"></div>
                      <span className="text-sm font-medium text-black">Светлая</span>
                    </button>
                    <button 
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "p-4 border rounded-xl flex flex-col items-center gap-2 transition-all",
                        theme === "dark" ? "border-primary bg-primary/5" : "hover:bg-muted"
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-800 shadow-sm"></div>
                      <span className="text-sm font-medium text-white">Тёмная</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <h3 className="font-medium">Плавные переходы страниц</h3>
                    <p className="text-sm text-muted-foreground">Использовать Framer Motion для анимаций.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </Card>
            </div>
          )}

          {activeTab === "verification" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-xl font-semibold mb-1">Верификация клиентов</h2>
                <p className="text-sm text-muted-foreground mb-6">Как новые клиенты будут подтверждать личность.</p>
              </div>
              
              <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <span className="text-blue-500">Telegram Bot</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">Отправка 4-значного кода в бота</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <h3 className="font-medium">Скрывать цены до верификации</h3>
                    <p className="text-sm text-muted-foreground">Помогает собрать базу контактов лидов.</p>
                  </div>
                  <Switch defaultChecked={false} />
                </div>
              </Card>
            </div>
          )}

          {/* Fallback for other tabs */}
          {!["general", "appearance", "verification"].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Settings2 className="w-12 h-12 opacity-20 mb-4" />
              <p>Раздел «{settingSections.find(s => s.id === activeTab)?.label}» находится в разработке.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
