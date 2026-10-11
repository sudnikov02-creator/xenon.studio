import { redirect } from "next/navigation";

export default function ClientDashboard({ params }: { params: { linkId: string } }) {
  // Тут в будущем будет PWA профиль клиента со статусами его броней
  // Для начала просто покажем информацию
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Личный кабинет</h1>
      <p className="text-muted-foreground">ID ссылки: {params.linkId}</p>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-6 border rounded-xl bg-card">
          <h2 className="text-xl font-semibold mb-4">Предстоящие записи</h2>
          <div className="text-sm text-muted-foreground">
            У вас нет активных записей.
          </div>
        </div>
        
        <div className="p-6 border rounded-xl bg-card">
          <h2 className="text-xl font-semibold mb-4">Баллы лояльности</h2>
          <div className="text-4xl font-bold text-primary">
            0
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            Статус: Новичок
          </div>
        </div>
      </div>
    </div>
  );
}