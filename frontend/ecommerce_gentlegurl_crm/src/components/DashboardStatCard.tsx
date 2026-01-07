interface DashboardStatCardProps {
  title: string
  value: string
  badgeText?: string
  helperText?: string
  tooltipLines?: string[]
  trend?: 'up' | 'down' | 'flat'
}

export default function DashboardStatCard({
  title,
  value,
  badgeText,
  helperText,
  tooltipLines,
  trend = 'up',
}: DashboardStatCardProps) {
  const trendColor =
    trend === 'down' ? 'text-rose-600' : trend === 'flat' ? 'text-slate-500' : 'text-emerald-600'
  const badgeBg =
    trend === 'down' ? 'bg-rose-50' : trend === 'flat' ? 'bg-slate-100' : 'bg-emerald-50'

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {badgeText && (
          <div className="relative group">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badgeBg} ${trendColor}`}>
              {badgeText}
            </span>
            {tooltipLines && tooltipLines.length > 0 && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
                {tooltipLines.map((line) => (
                  <p key={line} className="leading-5">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
      </div>
      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  )
}
