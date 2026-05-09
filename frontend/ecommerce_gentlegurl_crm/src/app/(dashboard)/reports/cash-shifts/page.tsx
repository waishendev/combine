import Link from 'next/link'
import { redirect } from 'next/navigation'

import CashShiftReportPage from '@/components/reports/CashShiftReportPage'
import { getCurrentUser } from '@/lib/auth'

export default async function CashShiftsReportRoute() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.reports.sales.view' || perm === 'reports.pos-summary.view' || perm === 'reports.my-pos-summary.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/cash-shifts" className="text-blue-600 hover:underline">
          Cash Shift Report
        </Link>
      </div>
      <h2 className="mb-2 text-3xl font-semibold">Cash Shift Report</h2>
      <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
        Tracks manually opened and closed POS cash shifts. Cash Sales include CASH order payment rows during the shift, with legacy cash orders as fallback.
      </p>
      <CashShiftReportPage />
    </div>
  )
}
