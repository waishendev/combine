'use client';

export default function CategorySalesChart({ data }: { data: { category: string; total: number }[] }) {
  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold">Category Sales</div>
      <div className="space-y-1 text-sm text-gray-700">
        {data.map((item) => (
          <div key={item.category} className="flex items-center justify-between">
            <span>{item.category}</span>
            <span className="font-medium">${item.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
