import Link from 'next/link'
import { redirect } from 'next/navigation'

import StaffCommissionReportPage from '@/components/StaffCommissionReportPage'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffCommissionReport() {
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
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/staff-commission" className="text-blue-600 hover:underline">
          Staff Commission
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Staff Commission</h2>
      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
        Product commission is calculated from final effective item value (<span className="font-semibold">effective line total × share % × commission rate snapshot</span>), while service package commissions continue to use stored package split snapshots.
      </p>
      <StaffCommissionReportPage />
    </div>
  )
}
