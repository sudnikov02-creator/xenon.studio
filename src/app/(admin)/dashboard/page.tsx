export default function AdminDashboard() {
  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Дашборд Фотографа</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Сегодня", value: "2 съёмки" },
          { label: "Ожидают", value: "5 заявок" },
          { label: "Доход", value: "45 000 ₽" },
          { label: "Отмены", value: "0%" },
        ].map((stat, i) => (
          <div key={i} className="p-6 border rounded-xl bg-card">
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="text-2xl font-bold mt-2">{stat.value}</div>
          </div>
        ))}
      </div>
      
      <div className="h-64 border rounded-xl flex items-center justify-center text-muted-foreground bg-card">
        График Recharts (Будет добавлен)
      </div>
    </div>
  );
}