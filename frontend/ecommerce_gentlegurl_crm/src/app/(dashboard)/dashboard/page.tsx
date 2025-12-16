import Link from 'next/link'

import DashboardSectionCard from '@/components/DashboardSectionCard'
import DashboardStatCard from '@/components/DashboardStatCard'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

const salesByMonth = [
  { label: 'Jan', value: 18000 },
  { label: 'Feb', value: 22000 },
  { label: 'Mar', value: 20500 },
  { label: 'Apr', value: 24500 },
  { label: 'May', value: 28000 },
  { label: 'Jun', value: 32000 },
]

const topProducts = [
  { name: 'Comfort Hoodie', category: 'Apparel', sales: 142, revenue: '$5,680' },
  { name: 'Wireless Earbuds', category: 'Electronics', sales: 97, revenue: '$9,505' },
  { name: 'Travel Backpack', category: 'Accessories', sales: 88, revenue: '$7,920' },
  { name: 'Desk Lamp', category: 'Home', sales: 74, revenue: '$3,480' },
]

const recentOrders = [
  { id: '#1045', customer: 'Evelyn Chen', total: '$240.00', status: 'Shipped' },
  { id: '#1044', customer: 'Lucas Silva', total: '$128.50', status: 'Processing' },
  { id: '#1043', customer: 'Priya Das', total: '$86.00', status: 'Delivered' },
  { id: '#1042', customer: 'Oliver Smith', total: '$420.00', status: 'Pending' },
]

const trafficSources = [
  { label: 'Direct', value: 38 },
  { label: 'Search', value: 32 },
  { label: 'Social', value: 18 },
  { label: 'Referral', value: 12 },
]

const fulfillment = [
  { label: 'Shipped', count: 164 },
  { label: 'Processing', count: 92 },
  { label: 'Pending', count: 37 },
  { label: 'Canceled', count: 11 },
]

export default async function DashboardPage() {
  // Default to EN for now, can be extended later for multi-language support
  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  const stats = [
    {
      title: t('dashboard.revenue'),
      value: '$128,450',
      changeLabel: '12%',
      helperText: t('dashboard.vsLastWeek'),
      trend: 'up' as const,
    },
    {
      title: t('dashboard.orders'),
      value: '2,431',
      changeLabel: '6%',
      helperText: t('dashboard.vsLastWeek'),
      trend: 'up' as const,
    },
    {
      title: t('dashboard.conversion'),
      value: '3.8%',
      changeLabel: '0.3%',
      helperText: t('dashboard.vsLastWeek'),
      trend: 'up' as const,
    },
    {
      title: t('dashboard.newCustomers'),
      value: '482',
      changeLabel: '4%',
      helperText: t('dashboard.vsLastWeek'),
      trend: 'down' as const,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6 overflow-y-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-gray-500">
          <span>{t('sidebar.dashboard')}</span>
          <span className="mx-2">/</span>
          <span className="text-slate-700">{t('dashboard.overviewTitle')}</span>
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
              href="/login"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 text-center"
            >
              {t('dashboard.goToStorefront')}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <DashboardSectionCard
          title={t('dashboard.salesPerformance')}
          description={t('dashboard.salesPerformanceDescription')}
        >
          <div className="space-y-3">
            {salesByMonth.map((month) => {
              const percentage = Math.min(100, Math.round((month.value / 32000) * 100))
              return (
                <div key={month.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{month.label}</span>
                    <span className="font-medium text-slate-800">
                      ${month.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard
          title={t('dashboard.topProducts')}
          description={t('dashboard.topProductsDescription')}
        >
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600">
                    <tr>
                      <th className="px-3 sm:px-4 py-3">{t('dashboard.product')}</th>
                      <th className="px-3 sm:px-4 py-3 hidden sm:table-cell">{t('dashboard.category')}</th>
                      <th className="px-3 sm:px-4 py-3 text-right">{t('dashboard.sales')}</th>
                      <th className="px-3 sm:px-4 py-3 text-right">{t('dashboard.revenue')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm">
                    {topProducts.map((product) => (
                      <tr key={product.name}>
                        <td className="px-3 sm:px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span>{product.name}</span>
                            <span className="text-xs text-slate-500 sm:hidden">{product.category}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-slate-600 hidden sm:table-cell">{product.category}</td>
                        <td className="px-3 sm:px-4 py-3 text-right text-slate-700">{product.sales}</td>
                        <td className="px-3 sm:px-4 py-3 text-right font-medium text-slate-900">
                          {product.revenue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard
          title={t('dashboard.recentOrders')}
          description={t('dashboard.recentOrdersDescription')}
        >
          <div className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{order.id}</p>
                  <p className="text-xs sm:text-sm text-slate-600 truncate">{order.customer}</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 text-sm">
                  <span className="font-medium text-slate-900">{order.total}</span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                      order.status === 'Shipped'
                        ? 'bg-emerald-50 text-emerald-700'
                        : order.status === 'Delivered'
                          ? 'bg-blue-50 text-blue-700'
                          : order.status === 'Processing'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DashboardSectionCard>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <DashboardSectionCard
          title={t('dashboard.trafficSources')}
          description={t('dashboard.trafficSourcesDescription')}
        >
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {trafficSources.map((source) => (
              <div
                key={source.label}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-800">{source.label}</span>
                <span className="text-sm font-semibold text-slate-900">{source.value}%</span>
              </div>
            ))}
          </div>
        </DashboardSectionCard>

        <DashboardSectionCard
          title={t('dashboard.fulfillment')}
          description={t('dashboard.fulfillmentDescription')}
        >
          <div className="space-y-3">
            {fulfillment.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="text-sm font-medium text-slate-800">
                    {item.label}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </DashboardSectionCard>
      </div>
    </div>
  )
}
