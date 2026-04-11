export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PosAppointmentsWorkspace from '@/components/pos/PosAppointmentsWorkspace'
import { getCurrentUser } from '@/lib/auth'

export default async function PosAppointmentsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('pos.checkout')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 xl:px-10">
      <PosAppointmentsWorkspace
        currentUser={{
          id: user.id,
          name: user.name,
          staff_id: user.staff_id ?? null,
          staff_name: user.staff_name ?? null,
        }}
      />
    </div>
  )
}
