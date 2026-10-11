"use server";

import prisma from "@/lib/prisma";

export type ServiceOption = {
  id: string;
  name: string;
  basePrice: number;
  duration: number;
};

export type LocationOption = {
  id: string;
  name: string;
  priceModifier: number;
};

/** Поля, которые реально нужны UI (подмножество модели `Service`) */
type ServiceRow = Pick<ServiceOption, "id" | "name" | "basePrice" | "duration">;

/** Поля, которые реально нужны UI (подмножество модели `Location`) */
type LocationRow = Pick<LocationOption, "id" | "name" | "priceModifier">;

const FALLBACK_SERVICES: ServiceOption[] = [
  { id: "s1", name: "Индивидуальная съемка", basePrice: 5000, duration: 60 },
  { id: "s2", name: "Love Story", basePrice: 7000, duration: 90 },
  { id: "s3", name: "Семейная фотосессия", basePrice: 8500, duration: 120 },
];

const FALLBACK_LOCATIONS: LocationOption[] = [
  { id: "l1", name: "Студия X (Центр)", priceModifier: 2000 },
  { id: "l2", name: "Уличная съемка", priceModifier: 0 },
  { id: "l3", name: "Фотостудия Y", priceModifier: 2500 },
];

export async function getServices(): Promise<ServiceOption[]> {
  try {
    const services = await prisma.service.findMany({
      where: { isHidden: false },
      orderBy: { basePrice: "asc" },
    });

    // Возвращаем fallback, если база пустая (для демо)
    if (services.length === 0) {
      return FALLBACK_SERVICES;
    }

    return services.map((s: ServiceRow): ServiceOption => ({
      id: s.id,
      name: s.name,
      basePrice: s.basePrice,
      duration: s.duration,
    }));
  } catch (error) {
    console.error("Failed to fetch services", error);
    return [];
  }
}

export async function getLocations(): Promise<LocationOption[]> {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: "asc" },
    });

    if (locations.length === 0) {
      return FALLBACK_LOCATIONS;
    }

    return locations.map((l: LocationRow): LocationOption => ({
      id: l.id,
      name: l.name,
      priceModifier: l.priceModifier,
    }));
  } catch (error) {
    console.error("Failed to fetch locations", error);
    return [];
  }
}

export async function getAvailableSlots(dateIso?: string): Promise<string[]> {
  // Имитация слотов для выбранного дня.
  // В реальности здесь должна быть логика проверки занятых слотов через prisma.booking.findMany
  await new Promise((r) => setTimeout(r, 500)); // Имитация задержки сети

  const allSlots = ["10:00", "11:30", "13:00", "15:30", "17:00", "18:30"];

  if (!dateIso) return allSlots;

  // Демо-логика: набор свободных слотов детерминированно зависит от даты
  const daySeed = Number(dateIso.replace(/\D/g, "")) % 5;
  return allSlots.filter((_, index) => (daySeed + index) % 5 !== 0);
}
