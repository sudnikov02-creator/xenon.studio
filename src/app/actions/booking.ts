"use server";

import prisma from "@/lib/prisma";

export async function getServices() {
  try {
    const services = await prisma.service.findMany({
      where: { isHidden: false },
      orderBy: { basePrice: 'asc' },
    });
    
    // Возвращаем fallback, если база пустая (для демо)
    if (services.length === 0) {
      return [
        { id: "s1", name: "Индивидуальная съемка", basePrice: 5000, duration: 60 },
        { id: "s2", name: "Love Story", basePrice: 7000, duration: 90 },
        { id: "s3", name: "Семейная фотосессия", basePrice: 8500, duration: 120 },
      ];
    }
    
    return services;
  } catch (error) {
    console.error("Failed to fetch services", error);
    return [];
  }
}

export async function getLocations() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
    });
    
    if (locations.length === 0) {
      return [
        { id: "l1", name: "Студия X (Центр)", priceModifier: 2000 },
        { id: "l2", name: "Уличная съемка", priceModifier: 0 },
        { id: "l3", name: "Фотостудия Y", priceModifier: 2500 },
      ];
    }
    
    return locations;
  } catch (error) {
    console.error("Failed to fetch locations", error);
    return [];
  }
}

export async function getAvailableSlots() {
  // Имитация слотов для выбранного дня
  // В реальности здесь должна быть логика проверки занятых слотов через prisma.booking.findMany
  await new Promise(r => setTimeout(r, 500)); // Имитация задержки сети
  
  return [
    "10:00", "11:30", "13:00", "15:30", "17:00", "18:30"
  ];
}
