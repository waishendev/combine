'use client';

export default function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      <div className="space-y-3 text-sm text-gray-700">{children}</div>
    </div>
  );
}
