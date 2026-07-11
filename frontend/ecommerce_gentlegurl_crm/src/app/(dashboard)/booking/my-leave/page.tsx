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
    <div className="crm-page-shell py-6 px-10 space-y-4">
      <div className="text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/my-leave" className="text-blue-600 hover:underline">My Leave</Link>
      </div>
      <h2 className="text-3xl font-semibold mb-2">My Leave</h2>
      <p className="mb-4 text-sm text-slate-600">
        View balances, apply for leave, and manage day-change requests on your approved leave.
      </p>

      {!hasStaffProfile ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This account is not a staff account, so leave records are not available.
        </div>
      ) : (
        <BookingMyLeavePage />
      )}
    </div>
  )
}
