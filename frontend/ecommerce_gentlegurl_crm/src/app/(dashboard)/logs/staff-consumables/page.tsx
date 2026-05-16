export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumableLogsPageContent from '@/components/StaffConsumableLogsPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffConsumableLogsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('pos.staff_consumables.view_logs')) {
    redirect('/dashboard')
  }

  return <StaffConsumableLogsPageContent />
}
