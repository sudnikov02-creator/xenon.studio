"use client";

import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Calendar as CalIcon, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

const data = [
  { name: "Пн", income: 15000, bookings: 3 },
  { name: "Вт", income: 22000, bookings: 4 },
  { name: "Ср", income: 12000, bookings: 2 },
  { name: "Чт", income: 35000, bookings: 6 },
  { name: "Пт", income: 28000, bookings: 5 },
  { name: "Сб", income: 45000, bookings: 8 },
  { name: "Вс", income: 38000, bookings: 7 },
];

export default function AdminDashboard() {
  const { theme } = useTheme();
  // Чтобы избежать гидратации с разными темами
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const primaryColor = mounted ? (theme === "dark" ? "#ffffff" : "#000000") : "#888888";
  const gridColor = mounted ? (theme === "dark" ? "#333333" : "#e5e5e5") : "#e5e5e5";

  return (
    <div className="min-h-screen p-6 max-w-[1400px] mx-auto space-y-6">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Обзор студии</h1>
          <p className="text-muted-foreground mt-1">Аналитика за текущую неделю</p>
        </div>
        <Badge variant="outline" className="px-4 py-1 text-sm bg-card">
          Текущий месяц: Октябрь
        </Badge>
      </div>
      
      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Доход (Неделя)", value: "195 000 ₽", icon: CreditCard, trend: "+12.5%" },
          { label: "Записей", value: "35", icon: CalIcon, trend: "+5" },
          { label: "Новых клиентов", value: "12", icon: Users, trend: "+2" },
          { label: "Средний чек", value: "5 570 ₽", icon: TrendingUp, trend: "+2.1%" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1 font-medium">
                {stat.trend} к прошлой неделе
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* График и Сайдбар */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* График */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Динамика дохода</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-[300px] w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value / 1000}k`}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke={primaryColor}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Последние записи */}
        <Card>
          <CardHeader>
            <CardTitle>Ожидают подтверждения</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { name: "Анна С.", service: "Love Story", time: "Завтра, 14:00", price: "7 000 ₽" },
              { name: "Игорь М.", service: "Индивидуальная", time: "24 Окт, 10:00", price: "5 000 ₽" },
              { name: "Мария К.", service: "Семейная", time: "25 Окт, 12:00", price: "8 500 ₽" },
            ].map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{b.name}</p>
                  <p className="text-sm text-muted-foreground">{b.service}</p>
                  <p className="text-xs text-yellow-600 font-medium">{b.time}</p>
                </div>
                <div className="font-medium">{b.price}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
