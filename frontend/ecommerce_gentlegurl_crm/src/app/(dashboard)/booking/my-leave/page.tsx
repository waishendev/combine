export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingMyLeavePage from '@/components/booking/BookingMyLeavePage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasStaffProfile = Boolean(user.staff_id)

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/my-leave" className="text-blue-600 hover:underline">My Leave</Link>
      </div>
      <h2 className="text-3xl font-semibold">My Leave</h2>

      {!hasStaffProfile ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This account is not linked to a staff profile, so personal leave records are unavailable.
        </div>
      ) : (
        <BookingMyLeavePage />
      )}
    </div>
  )
}
