'use client';

export default function SalesOverviewChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold">Sales Overview</div>
      <div className="space-y-2 text-sm text-gray-700">
        {data.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span>{item.label}</span>
            <span className="font-medium">${item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
