import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const port = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
const wss = new WebSocketServer({ port });
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_for_jwt';

export interface ClientData {
  userId: string;
  role: 'PHOTOGRAPHER' | 'CLIENT';
}

const connectedClients = new Map<WebSocket, ClientData>();

wss.on('connection', (ws) => {
  console.log('Новый WebSocket клиент подключен');

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      
      if (parsed.type === 'INIT') {
        // Аутентификация при подключении
        const token = parsed.token;
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as ClientData;
          connectedClients.set(ws, decoded);
          ws.send(JSON.stringify({ type: 'INIT_SUCCESS', payload: { userId: decoded.userId } }));
          console.log(`Клиент авторизован: ${decoded.userId} [${decoded.role}]`);
        } catch (err) {
          ws.send(JSON.stringify({ type: 'ERROR', payload: 'Invalid token' }));
          ws.close();
        }
      }
      
      if (parsed.type === 'SEND_MESSAGE') {
        const clientData = connectedClients.get(ws);
        if (!clientData) return;

        // Сохраняем сообщение в БД
        const msg = await prisma.message.create({
          data: {
            bookingId: parsed.payload.bookingId,
            text: parsed.payload.text,
            sender: clientData.role === 'PHOTOGRAPHER' ? 'PHOTOGRAPHER' : 'CLIENT',
          },
        });

        // Рассылаем всем заинтересованным (в реальности — фильтр по bookingId)
        broadcastMessage({
          type: 'NEW_MESSAGE',
          payload: msg,
        });
      }

      if (parsed.type === 'STATUS_CHANGE') {
        // Обработка смены статуса (только для фотографа)
        const clientData = connectedClients.get(ws);
        if (clientData?.role === 'PHOTOGRAPHER') {
          // Логика смены статуса, логирования в AuditLog и рассылки
          broadcastMessage({
            type: 'STATUS_UPDATED',
            payload: { bookingId: parsed.payload.bookingId, statusId: parsed.payload.statusId }
          });
        }
      }

    } catch (e) {
      console.error('Ошибка обработки WS сообщения:', e);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log('WebSocket клиент отключился');
  });
});

export function broadcastMessage(message: any, filterFn?: (client: ClientData) => boolean) {
  const dataStr = JSON.stringify(message);
  for (const [ws, clientData] of connectedClients.entries()) {
    if (!filterFn || filterFn(clientData)) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(dataStr);
      }
    }
  }
}

console.log(`WebSocket сервер запущен на порту ${port}`);
