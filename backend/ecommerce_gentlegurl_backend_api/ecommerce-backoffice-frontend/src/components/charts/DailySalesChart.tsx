'use client';

export default function DailySalesChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold">Daily Sales</div>
      <div className="space-y-1 text-sm text-gray-700">
        {data.map((item) => (
          <div key={item.date} className="flex items-center justify-between">
            <span>{item.date}</span>
            <span className="font-medium">${item.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
