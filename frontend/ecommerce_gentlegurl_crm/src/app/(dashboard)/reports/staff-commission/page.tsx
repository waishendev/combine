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
    (perm) => perm === 'ecommerce.reports.sales.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/staff-commission" className="text-blue-600 hover:underline">
          Staff Commission
        </Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">Staff Commission</h2>
      <StaffCommissionReportPage />
    </div>
  )
}
