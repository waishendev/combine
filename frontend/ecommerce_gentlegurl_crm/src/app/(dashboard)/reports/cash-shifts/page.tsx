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
    <div className="crm-page-shell px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/cash-shifts" className="text-blue-600 hover:underline">
          Cash Shift Report
        </Link>
      </div>
      <h2 className="mb-2 text-3xl font-semibold">Cash Shift Report</h2>
      <CashShiftReportPage />
    </div>
  )
}
