export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PosAppointmentsWorkspace from '@/components/pos/PosAppointmentsWorkspace'
import PosCashShiftGate from '@/components/pos/PosCashShiftGate'
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
    <div className="crm-page-shell pos-appt-page min-h-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-6">
      <PosCashShiftGate defaultStaffId={user.staff_id ?? null}>
        <PosAppointmentsWorkspace
          currentUser={{
            id: user.id,
            name: user.name,
            staff_id: user.staff_id ?? null,
            staff_name: user.staff_name ?? null,
          }}
          permissions={user.permissions}
        />
      </PosCashShiftGate>
    </div>
  )
}
