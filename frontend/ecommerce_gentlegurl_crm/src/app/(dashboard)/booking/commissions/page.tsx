export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import StaffCommissionsTable from '@/components/commissions/StaffCommissionsTable'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'booking.commissions.view' || perm === 'booking.commissions.override',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/commissions" className="text-blue-600 hover:underline">
          Staff Booking Commissions
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Staff Booking Commissions</h2>
      <StaffCommissionsTable type="BOOKING" routeBasePath="/booking/commissions" countLabel="Booking Count" />
    </div>
  )
}
