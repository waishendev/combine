export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingLeaveCalendarShell from '@/components/booking/BookingLeaveCalendarShell'
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
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/leave-calendar" className="text-blue-600 hover:underline">
          Leave Calendar
        </Link>
      </div>
      <BookingLeaveCalendarShell permissions={user.permissions} />
    </div>
  )
}
