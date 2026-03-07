import Link from 'next/link'
import { redirect } from 'next/navigation'

import MyPosSummaryPage from '@/components/MyPosSummaryPage'
import { getCurrentUser } from '@/lib/auth'

export default async function PosSummaryReport() {
  const user = await getCurrentUser()

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
      <MyPosSummaryPage reportPath="/api/proxy/ecommerce/reports/pos-summary" />
    </div>
  )
}
