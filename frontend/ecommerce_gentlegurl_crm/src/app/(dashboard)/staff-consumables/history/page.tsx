export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumableHistoryPageContent from '@/components/StaffConsumableHistoryPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffConsumableHistoryPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.staff_id) {
    redirect('/dashboard')
  }

  return <StaffConsumableHistoryPageContent />
}
