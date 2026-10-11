import { create } from 'zustand';

interface Message {
  id: string;
  bookingId: string;
  sender: 'CLIENT' | 'PHOTOGRAPHER' | 'SYSTEM';
  text: string;
  isRead: boolean;
  createdAt: Date;
}

interface AppState {
  // WebSocket State
  isWsConnected: boolean;
  socket: WebSocket | null;
  
  // Data State
  messages: Message[];
  
  // Actions
  connectWs: (token: string) => void;
  disconnectWs: () => void;
  sendMessage: (bookingId: string, text: string) => void;
  addMessage: (msg: Message) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  isWsConnected: false,
  socket: null,
  messages: [],
  
  connectWs: (token: string) => {
    // Предотвращаем дублирование соединений
    if (get().socket) return;
    
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      // Инициализируем сессию токеном
      ws.send(JSON.stringify({ type: 'INIT', token }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'INIT_SUCCESS') {
          set({ isWsConnected: true });
        } else if (data.type === 'NEW_MESSAGE') {
          get().addMessage(data.payload);
        } else if (data.type === 'STATUS_UPDATED') {
          // TODO: логика обновления статуса записи в UI без перезагрузки
          console.log('Status updated event received:', data.payload);
        }
      } catch (e) {
        console.error('Ошибка парсинга WS-сообщения:', e);
      }
    };
    
    ws.onclose = () => {
      set({ isWsConnected: false, socket: null });
      // Пытаемся восстановить соединение через 3 секунды
      setTimeout(() => get().connectWs(token), 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error: ', error);
    };
    
    set({ socket: ws });
  },
  
  disconnectWs: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isWsConnected: false });
    }
  },
  
  sendMessage: (bookingId: string, text: string) => {
    const { socket, isWsConnected } = get();
    if (socket && isWsConnected) {
      socket.send(JSON.stringify({
        type: 'SEND_MESSAGE',
        payload: { bookingId, text }
      }));
    }
  },
  
  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
  }
}));
