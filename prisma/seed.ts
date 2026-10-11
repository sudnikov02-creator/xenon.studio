import { PrismaClient, CancelPolicy, ReschedulePolicy } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Начало сидирования...');

  // 1. Создание фотографа
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const photographer = await prisma.photographer.upsert({
    where: { email: 'admin@xenon.studio' },
    update: {},
    create: {
      email: 'admin@xenon.studio',
      hashedPassword,
      name: 'Фотограф Xenon',
      phone: '+79991234567',
    },
  });
  console.log('Фотограф создан:', photographer.email);

  // 2. Создание статусов
  const statuses = [
    { name: 'Новая заявка', color: '#eab308', icon: 'Clock', cancelPolicy: CancelPolicy.FREE, reschedulePolicy: ReschedulePolicy.FREE },
    { name: 'Подтверждено', color: '#3b82f6', icon: 'CheckCircle', cancelPolicy: CancelPolicy.PAID, reschedulePolicy: ReschedulePolicy.FREE },
    { name: 'Завершено', color: '#22c55e', icon: 'Check', cancelPolicy: CancelPolicy.FORBIDDEN, reschedulePolicy: ReschedulePolicy.FORBIDDEN, isReviewable: true },
    { name: 'Отменено', color: '#ef4444', icon: 'XCircle', cancelPolicy: CancelPolicy.FORBIDDEN, reschedulePolicy: ReschedulePolicy.FORBIDDEN },
  ];

  for (const s of statuses) {
    await prisma.status.create({
      data: s,
    });
  }
  console.log('Статусы созданы');

  // 3. Создание услуг
  const services = [
    { name: 'Индивидуальная съемка', description: 'Студия или улица', basePrice: 5000, duration: 60 },
    { name: 'Love Story', description: 'Романтическая фотосессия', basePrice: 7000, duration: 90 },
    { name: 'Семейная фотосессия', description: 'До 5 человек', basePrice: 8500, duration: 120 },
  ];

  for (const s of services) {
    await prisma.service.create({
      data: s,
    });
  }
  console.log('Услуги созданы');

  // 4. Создание локаций
  const locations = [
    { name: 'Студия X (Центр)', priceModifier: 2000, bufferModifier: 0 },
    { name: 'Уличная съемка', priceModifier: 0, bufferModifier: 30 },
    { name: 'Фотостудия Y', priceModifier: 2500, bufferModifier: 0 },
  ];

  for (const l of locations) {
    await prisma.location.create({
      data: l,
    });
  }
  console.log('Локации созданы');

  console.log('Сидирование завершено успешно!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
