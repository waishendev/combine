export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingLeaveCalendarPage from '@/components/booking/BookingLeaveCalendarPage'
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
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/leave-calendar" className="text-blue-600 hover:underline">Leave Calendar</Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Leave Calendar</h2>
      <BookingLeaveCalendarPage />
    </div>
  )
}
