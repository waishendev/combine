import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import SalesVisualWorkspaceClient from '@/components/reports/SalesVisualWorkspaceClient'
import { getCurrentUser } from '@/lib/auth'

export default async function SalesVisualPage() {
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
      <SalesVisualWorkspaceClient canExport={canExport} />
    </Suspense>
  )
}
