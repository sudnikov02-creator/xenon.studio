import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'mock_token');

bot.start(async (ctx) => {
  const tgId = ctx.from.id.toString();
  const username = ctx.from.username;
  
  try {
    // Ищем клиента по Telegram ID
    let client = await prisma.client.findUnique({ where: { telegramId: tgId } });
    
    // Если не нашли, но есть username - пытаемся найти по username
    if (!client && username) {
      client = await prisma.client.findFirst({ where: { telegramUsername: username } });
    }

    if (!client) {
      // Клиент полностью новый
      const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 цифры
      
      client = await prisma.client.create({
        data: {
          telegramId: tgId,
          telegramUsername: username,
          name: ctx.from.first_name || 'Без имени',
          verificationCode: code,
          verificationExpiry: new Date(Date.now() + 15 * 60 * 1000), // годен 15 минут
        }
      });
      
      return ctx.reply(`Добро пожаловать в xenon.studio!\nВаш код верификации: ${code}\nВведите его на сайте для подтверждения.`);
    } else {
      // Клиент уже есть в базе
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      
      await prisma.client.update({
        where: { id: client.id },
        data: { 
          telegramId: tgId, // на случай, если нашли по username
          verificationCode: code,
          verificationExpiry: new Date(Date.now() + 15 * 60 * 1000) 
        }
      });
      
      return ctx.reply(`С возвращением, ${client.name}!\nВаш новый код верификации: ${code}`, {
        reply_markup: {
          inline_keyboard: [[{ text: 'Отправить код заново', callback_data: 'resend_code' }]]
        }
      });
    }
  } catch (err) {
    console.error('Ошибка в боте:', err);
    ctx.reply('Произошла ошибка при обработке запроса. Попробуйте позже.');
  }
});

bot.action('resend_code', async (ctx) => {
  const tgId = ctx.from.id.toString();
  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.client.update({
      where: { telegramId: tgId },
      data: {
        verificationCode: code,
        verificationExpiry: new Date(Date.now() + 15 * 60 * 1000)
      }
    });
    ctx.answerCbQuery('Код обновлен');
    ctx.reply(`Ваш новый код верификации: ${code}`);
  } catch (e) {
    ctx.answerCbQuery('Ошибка при обновлении кода');
  }
});

bot.launch();
console.log('Telegram бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
