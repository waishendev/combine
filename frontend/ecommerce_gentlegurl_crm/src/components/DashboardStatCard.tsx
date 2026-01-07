interface DashboardStatCardProps {
  title: string
  value: string
  helperText?: string
  changeLabel?: string
  comparisonText?: string
  trend?: 'up' | 'down' | 'flat'
}

export default function DashboardStatCard({
  title,
  value,
  helperText,
  changeLabel,
  comparisonText,
  trend = 'up',
}: DashboardStatCardProps) {
  const trendColor =
    trend === 'down' ? 'text-rose-600' : trend === 'flat' ? 'text-slate-500' : 'text-emerald-600'
  const trendSymbol = trend === 'down' ? '▼' : trend === 'flat' ? '•' : '▲'

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
      {comparisonText ? (
        <p className={`mt-1 text-xs ${trendColor}`}>{comparisonText}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
  </div>
)
}
