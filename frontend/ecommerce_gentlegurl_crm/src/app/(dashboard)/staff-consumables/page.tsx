export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumablesPageContent from '@/components/StaffConsumablesPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffConsumablesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canUseConsumables = Boolean(user.staff_id) && user.permissions.includes('pos.checkout')
  if (!canUseConsumables) {
    redirect('/dashboard')
  }

  return <StaffConsumablesPageContent />
}
