import Link from 'next/link'
import { redirect } from 'next/navigation'

import MyPosSummaryPage from '@/components/MyPosSummaryPage'
import { getCurrentUser } from '@/lib/auth'

type PosSummaryReportPageProps = {
  searchParams?: {
    created_by_user_id?: string
    staff_name?: string
  } | Promise<{
    created_by_user_id?: string
    staff_name?: string
  }>
}

export default async function PosSummaryReport({ searchParams }: PosSummaryReportPageProps) {
  const user = await getCurrentUser()
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {}
  const createdByUserId = resolvedSearchParams.created_by_user_id ?? ''
  const staffName = resolvedSearchParams.staff_name ?? ''

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'reports.pos-summary.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/pos-summary" className="text-blue-600 hover:underline">
          POS Summary Report
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">POS Summary Report</h2>
      <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
        Includes consolidated POS sales from products and services.
      </p>
      <p className="mb-4 text-xs text-gray-500">Default filter range now shows last 12 months to avoid empty data on current-month-only filter.</p>
      <MyPosSummaryPage
        reportPath="/api/proxy/ecommerce/reports/pos-summary"
        initialCreatedByUserId={createdByUserId}
        initialHandledByName={staffName}
      />
    </div>
  )
}
