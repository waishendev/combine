import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import SalesSummaryWorkspaceClient from '@/components/reports/SalesSummaryWorkspaceClient'
import { getCurrentUser } from '@/lib/auth'

export default async function SalesReportPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('ecommerce.reports.sales.view')) {
    redirect('/dashboard')
  }

  const canViewStaffReport = user.permissions.includes('ecommerce.reports.sales.staff.view')

  return (
    <Suspense fallback={<div className="p-10 text-sm text-slate-600">Loading report…</div>}>
      <SalesSummaryWorkspaceClient canViewStaffReport={canViewStaffReport} />
    </Suspense>
  )
}
