import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import SalesReportDailyDetailClient from '@/components/reports/SalesReportDailyDetailClient'
import { getCurrentUser } from '@/lib/auth'

export default async function SalesReportDailyDetailPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('ecommerce.reports.sales.view')) {
    redirect('/dashboard')
  }

  const canExport = user.permissions.includes('ecommerce.reports.sales.export')

  return (
    <Suspense fallback={<div className="p-10 text-sm text-slate-600">Loading report…</div>}>
      <SalesReportDailyDetailClient canExport={canExport} />
    </Suspense>
  )
}
