import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import PosCashShiftGate from '@/components/pos/PosCashShiftGate'
import SalesVisualWorkspaceClient from '@/components/reports/SalesVisualWorkspaceClient'
import { getCurrentUser } from '@/lib/auth'

export default async function SalesVisualPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('ecommerce.daily-sales-reports.view')) {
    redirect('/dashboard')
  }

  const canExport = user.permissions.includes('ecommerce.reports.sales.export')

  const canUpdateOrder = user.permissions.includes('ecommerce.orders.update')
  const canVoidRefund =
    user.permissions.includes('pos.checkout')
    || user.permissions.includes('pos.appointments.manage')
    || canUpdateOrder
  const canManageCashShift = user.permissions.includes('pos.checkout')
  const canViewStaffReport = user.permissions.includes('ecommerce.reports.sales.staff.view')

  return (
    <div className="crm-page-shell min-h-0">
      <PosCashShiftGate
        defaultStaffId={user.staff_id ?? null}
        cashShiftRequired
        canManageCashShift={canManageCashShift}
      >
        <Suspense fallback={<div className="p-10 text-sm text-slate-600">Loading report…</div>}>
          <SalesVisualWorkspaceClient canExport={canExport} canUpdateOrder={canUpdateOrder} canVoidRefund={canVoidRefund} canViewStaffReport={canViewStaffReport} />
        </Suspense>
      </PosCashShiftGate>
    </div>
  )
}
