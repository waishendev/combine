export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumablesPageContent from '@/components/StaffConsumablesPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffConsumablesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canUseConsumables = user.permissions.includes('pos.staff_consumables.access')
  if (!canUseConsumables) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell pos-checkout-page min-h-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 lg:px-6">
      <StaffConsumablesPageContent
        canCheckout={user.permissions.includes('pos.staff_consumables.checkout')}
        canViewLogs={user.permissions.includes('pos.staff_consumables.view_logs')}
      />
    </div>
  )
}
