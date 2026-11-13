import Link from 'next/link'
import { redirect } from 'next/navigation'

import MonthlyServicesReportPage from '@/components/reports/MonthlyServicesReportPage'
import { getCurrentUser } from '@/lib/auth'

type MonthlyServicesReportRouteProps = {
  searchParams?: Promise<{
    year?: string
    month?: string
    month_from?: string
    month_to?: string
  }>
}

export default async function MonthlyServicesReportRoute({ searchParams }: MonthlyServicesReportRouteProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.reports.sales.view' || perm === 'ecommerce.daily-sales-reports.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const year = Number(resolvedSearchParams.year)
  const monthFrom = Number(resolvedSearchParams.month_from || resolvedSearchParams.month)
  const monthTo = Number(resolvedSearchParams.month_to || resolvedSearchParams.month)

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/monthly-services" className="text-blue-600 hover:underline">
          Monthly Services Report
        </Link>
      </div>

      <h2 className="text-3xl font-semibold mb-6">Monthly Services Report</h2>

      <MonthlyServicesReportPage
        initialYear={Number.isFinite(year) && year >= 2000 ? year : undefined}
        initialMonthFrom={Number.isFinite(monthFrom) && monthFrom >= 1 && monthFrom <= 12 ? monthFrom : undefined}
        initialMonthTo={Number.isFinite(monthTo) && monthTo >= 1 && monthTo <= 12 ? monthTo : undefined}
      />
    </div>
  )
}
