export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingLeaveLogsPage from '@/components/booking/BookingLeaveLogsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.leave.logs.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/leave-logs" className="text-blue-600 hover:underline">Leave Logs</Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Leave Logs</h2>
      <BookingLeaveLogsPage />
    </div>
  )
}
