interface DashboardStatCardProps {
  title: string
  value: string
  helperText?: string
  changeLabel?: string
  trend?: 'up' | 'down'
}

export default function DashboardStatCard({
  title,
  value,
  helperText,
  changeLabel,
  trend = 'up',
}: DashboardStatCardProps) {
  const trendColor = trend === 'down' ? 'text-rose-600' : 'text-emerald-600'
  const trendSymbol = trend === 'down' ? '▼' : '▲'

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-slate-900">{value}</span>
        {changeLabel && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendSymbol} {changeLabel}
          </span>
        )}
      </div>
      {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  )
}
