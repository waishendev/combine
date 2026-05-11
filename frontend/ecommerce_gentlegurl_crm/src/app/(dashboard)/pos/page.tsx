export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PosPageContent from '@/components/PosPageContent'
import PosCashShiftGate from '@/components/pos/PosCashShiftGate'
import { getCurrentUser } from '@/lib/auth'

export default async function PosPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('pos.checkout')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="w-full overflow-visible px-3 pb-24 pt-4 sm:px-4 sm:pt-5 md:px-6 md:pb-28 md:pt-6 lg:px-8 lg:pb-10 xl:px-10">
      <PosCashShiftGate defaultStaffId={user.staff_id ?? null}>
        <PosPageContent
          currentUser={{
            id: user.id,
            name: user.name,
            staff_id: user.staff_id ?? null,
            staff_name: user.staff_name ?? null,
          }}
        />
      </PosCashShiftGate>
    </div>
  )
}
