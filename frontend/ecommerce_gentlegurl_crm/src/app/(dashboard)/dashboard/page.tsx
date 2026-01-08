'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import DashboardSectionCard from '@/components/DashboardSectionCard'
import DashboardStatCard from '@/components/DashboardStatCard'
import { useI18n } from '@/lib/i18n'

type MonthlySalesPoint = {
  month: string
  revenue: number
  return_amount: number
  net_revenue: number
  orders_count: number
}

type KpiComparison = {
  current: number
  previous: number
  delta: number
  delta_percent: number
  trend: 'up' | 'down' | 'flat'
}

type TopProduct = {
  product_id: number
  product_name: string
  sku: string | null
  qty: number
  revenue: number
  net_revenue: number
  refund_amount: number
  refund_percent: number
}

type DashboardOverviewResponse = {
  date_range: {
    from: string
    to: string
  }
  kpis: {
    revenue: KpiComparison
    net_revenue: KpiComparison
    orders_count: KpiComparison
    new_customers: KpiComparison
    refund_amount: KpiComparison
  }
  charts: {
    monthly_sales: MonthlySalesPoint[]
  }
  top_products: TopProduct[]
}

const numberFormatter = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatNumber = (value: number) => numberFormatter.format(value)

const formatPercent = (value: number) => `${value.toFixed(2)}%`

const buildBadgeText = (comparison: KpiComparison) => {
  if (comparison.previous === 0 && comparison.current > 0) {
    return '↑ new'
  }

  if (comparison.trend === 'flat') {
    return `— ${formatPercent(0)}`
  }

  const sign = comparison.trend === 'down' ? '-' : '+'
  return `${comparison.trend === 'down' ? '↓' : '↑'} ${sign}${formatPercent(Math.abs(comparison.delta_percent))}`
}

const buildTooltipLines = (
  comparison: KpiComparison,
  formatter: (value: number) => string,
) => [
  `This month: ${formatter(comparison.current)}`,
  `Last month: ${formatter(comparison.previous)}`,
  `Delta: ${formatter(comparison.delta)}`,
]

export default function DashboardPage() {
  const { t } = useI18n()
  const [data, setData] = useState<DashboardOverviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const fetchOverview = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/proxy/ecommerce/dashboard/overview', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          const message = await res.text()
          setError(message || 'Failed to load dashboard overview.')
          setData(null)
          return
        }

        const response: DashboardOverviewResponse & { success?: boolean; message?: string } = await res.json()
          .catch(() => ({} as DashboardOverviewResponse))

        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        setData(response)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard overview.')
          setData(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchOverview()

    return () => controller.abort()
  }, [])

  const monthlySales = data?.charts.monthly_sales ?? []
  const maxRevenue = useMemo(() => {
    return monthlySales.reduce((max, item) => Math.max(max, item.net_revenue), 0)
  }, [monthlySales])
  const chartTicks = useMemo(() => {
    if (maxRevenue <= 0) {
      return [0, 0, 0, 0]
    }

    const step = maxRevenue / 3
    return [maxRevenue, maxRevenue - step, maxRevenue - step * 2, 0]
  }, [maxRevenue])

  const stats = useMemo(() => {
    if (!data) {
      return []
    }

    return [
      {
        title: t('dashboard.revenue'),
        value: formatCurrency(data.kpis.net_revenue.current),
        badgeText: buildBadgeText(data.kpis.net_revenue),
        tooltipLines: buildTooltipLines(data.kpis.net_revenue, formatCurrency),
        trend: data.kpis.net_revenue.trend,
      },
      {
        title: t('dashboard.orders'),
        value: formatNumber(data.kpis.orders_count.current),
        badgeText: buildBadgeText(data.kpis.orders_count),
        tooltipLines: buildTooltipLines(data.kpis.orders_count, formatNumber),
        trend: data.kpis.orders_count.trend,
      },
      {
        title: t('dashboard.newCustomers'),
        value: formatNumber(data.kpis.new_customers.current),
        badgeText: buildBadgeText(data.kpis.new_customers),
        tooltipLines: buildTooltipLines(data.kpis.new_customers, formatNumber),
        trend: data.kpis.new_customers.trend,
      },
      {
        title: 'Refund Amount',
        value: formatCurrency(data.kpis.refund_amount.current),
        badgeText: buildBadgeText(data.kpis.refund_amount),
        tooltipLines: buildTooltipLines(data.kpis.refund_amount, formatCurrency),
        trend: data.kpis.refund_amount.trend,
      },
    ]
  }, [data, t])

  return (
    <div className="space-y-4 sm:space-y-6 overflow-y-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-2">
        <div className="text-xs mb-4">
          <span className="text-gray-500">Home</span>
          <span className="mx-1">/</span>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline"
          >
            {t('sidebar.dashboard')}
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              {t('dashboard.overviewTitle')}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              {t('dashboard.overviewSubtitle')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              href="/admins"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 text-center"
            >
              {t('dashboard.manageAdmins')}
            </Link>
            <Link
              href="/product"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 text-center"
            >
              {t('dashboard.goToStorefront')}
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`kpi-skeleton-${index}`}
                className="animate-pulse rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="mt-4 h-7 w-32 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-20 rounded bg-slate-100" />
              </div>
            ))
          : stats.map((stat) => <DashboardStatCard key={stat.title} {...stat} />)}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <DashboardSectionCard
          title="Monthly Sales"
          description="Last 5 months"
        >
          {loading ? (
            <div className="flex items-end gap-3 h-48 animate-pulse">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`sales-skeleton-${index}`} className="flex-1">
                  <div className="h-32 rounded-md bg-slate-200" />
                  <div className="mt-2 h-3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-56">
              <div className="relative flex h-full">
                <div className="absolute inset-y-0 left-0 flex w-16 flex-col justify-between text-[11px] text-slate-400">
                  {chartTicks.map((tick, index) => (
                    <span key={`tick-${index}`}>{currencyFormatter.format(tick)}</span>
                  ))}
                </div>
                <div className="ml-16 flex h-full w-full items-end gap-4">
                  {monthlySales.map((month) => {
                    const heightPercent = maxRevenue > 0 ? (month.net_revenue / maxRevenue) * 100 : 0
                    const aov = month.orders_count > 0 ? month.net_revenue / month.orders_count : 0

                    return (
                      <div key={month.month} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                        <div className="flex h-full w-full items-end">
                          <div
                            className="w-full rounded-md bg-indigo-500 transition group-hover:bg-indigo-600"
                            style={{ height: `${Math.max(heightPercent, 6)}%` }}
                          />
                        </div>
                        <span className="mt-2 text-xs text-slate-500">{month.month}</span>
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
                          <p className="text-xs text-slate-500">Month: {month.month}</p>
                          <p className="text-sm font-semibold text-slate-900">
                            Net Revenue: {formatCurrency(month.net_revenue)}
                          </p>
                          <p>Orders: {formatNumber(month.orders_count)}</p>
                          {month.orders_count > 0 && <p>AOV: {formatCurrency(aov)}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard
          title={t('dashboard.productSales')}
          description="This Month"
        >
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
                    <tr>
                      <th className="px-3 sm:px-4 py-3">Product</th>
                      <th className="px-3 sm:px-4 py-3 text-right">Qty</th>
                      <th className="px-3 sm:px-4 py-3 text-right">Net Revenue</th>
                      <th className="px-3 sm:px-4 py-3 text-right">Refund %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={`product-skeleton-${index}`}>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="h-4 w-28 rounded bg-slate-200" />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <div className="ml-auto h-4 w-8 rounded bg-slate-200" />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <div className="ml-auto h-4 w-16 rounded bg-slate-200" />
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <div className="ml-auto h-4 w-10 rounded bg-slate-200" />
                          </td>
                        </tr>
                      ))
                    ) : data?.top_products.length ? (
                      data.top_products.map((product) => (
                        <tr key={product.product_id}>
                          <td className="px-3 sm:px-4 py-3 font-medium text-slate-900">
                            <div className="flex flex-col">
                              <span>{product.product_name}</span>
                              {/* {product.sku && (
                                <span className="text-xs text-slate-500">{product.sku}</span>
                              )} */}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right text-slate-700">
                            {formatNumber(product.qty)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right font-medium text-slate-900">
                            {formatCurrency(product.net_revenue)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right text-slate-700">
                            {formatPercent(product.refund_percent || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 sm:px-4 py-6 text-center text-sm text-slate-500">
                          {t('table.no_data')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DashboardSectionCard>
      </div>
    </div>
  )
}
