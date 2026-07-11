export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingLeaveRequestsPage from '@/components/booking/BookingLeaveRequestsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.schedules.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell px-4 py-4 sm:px-10 sm:py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/leave-requests" className="text-blue-600 hover:underline">Leave Requests</Link>
      </div>
      <h2 className="mb-2 text-2xl font-semibold sm:text-3xl">Leave Requests</h2>
      <p className="mb-6 text-sm text-slate-600">
        Review pending leave and day-change requests. Request type shows whether staff applied for new leave or requested a date change.
      </p>
      <BookingLeaveRequestsPage />
    </div>
  )
}
