import { ReactNode } from 'react'

interface DashboardSectionCardProps {
  title: string
  description?: string
  children: ReactNode
}

export default function DashboardSectionCard({
  title,
  description,
  children,
}: DashboardSectionCardProps) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}
