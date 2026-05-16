export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumablesPageContent from '@/components/StaffConsumablesPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffConsumablesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canUseConsumables = Boolean(user.staff_id) && user.permissions.includes('pos.staff_consumables.access')
  if (!canUseConsumables) {
    redirect('/dashboard')
  }

  return (
    <StaffConsumablesPageContent
      canCheckout={user.permissions.includes('pos.staff_consumables.checkout')}
      canViewLogs={user.permissions.includes('pos.staff_consumables.view_logs')}
    />
  )
}
