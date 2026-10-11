"use client";

import { useEffect, useState } from "react";
import { Search, Send, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const mockChats = [
  { id: "bk_1", name: "Иван Иванов", service: "Индивидуальная", lastMessage: "Да, хочу строгий стиль", time: "10:45", unread: 1 },
  { id: "bk_2", name: "Анна Смирнова", service: "Love Story", lastMessage: "Где находится студия?", time: "Вчера", unread: 0 },
];

export default function AdminChatPage() {
  const [activeChat, setActiveChat] = useState(mockChats[0].id);
  const [message, setMessage] = useState("");
  const { messages, connectWs, sendMessage } = useAppStore();

  useEffect(() => {
    // В реальности здесь подставляется JWT фотографа
    connectWs("mock_admin_token");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage(activeChat, message);
    setMessage("");
  };

  return (
    <div className="h-full flex bg-background p-6 max-w-[1600px] mx-auto gap-6">
      
      {/* Список чатов */}
      <div className="w-80 flex flex-col bg-card border rounded-xl overflow-hidden shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg mb-4">Сообщения</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск по имени..." className="pl-9 bg-muted/50" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {mockChats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={cn(
                "p-4 border-b cursor-pointer transition-colors hover:bg-muted/50",
                activeChat === chat.id ? "bg-muted" : ""
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="font-semibold">{chat.name}</div>
                <div className="text-xs text-muted-foreground">{chat.time}</div>
              </div>
              <div className="text-xs text-primary font-medium mb-1">{chat.service}</div>
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground truncate pr-2">{chat.lastMessage}</div>
                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {chat.unread}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Окно чата */}
      <div className="flex-1 flex flex-col bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">И</div>
          <div>
            <div className="font-semibold">Иван Иванов</div>
            <div className="text-xs text-muted-foreground">Запись: Индивидуальная съемка (24 Окт, 14:00)</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          <div className="text-center text-xs text-muted-foreground my-4">Сегодня</div>
          
          <div className="flex flex-col items-start gap-1">
            <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-2 text-sm shadow-sm">
              Да, хочу что-то в строгом стиле.
            </div>
            <div className="text-xs text-muted-foreground ml-1">10:45</div>
          </div>
          
          {/* Рендерим реальные сообщения из Zustand */}
          {messages.filter(m => m.bookingId === activeChat).map((m, i) => {
            const isMe = m.sender === "PHOTOGRAPHER";
            return (
              <div key={i} className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "rounded-2xl px-4 py-2 text-sm shadow-sm",
                  isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm"
                )}>
                  {m.text}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMe && <CheckCheck className="w-3 h-3 text-blue-500" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <Input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Написать сообщение клиенту..." 
              className="bg-muted/50 border-transparent focus-visible:ring-primary/50 rounded-xl h-12" 
            />
            <Button size="icon" className="h-12 w-12 rounded-xl shrink-0" onClick={handleSend}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
