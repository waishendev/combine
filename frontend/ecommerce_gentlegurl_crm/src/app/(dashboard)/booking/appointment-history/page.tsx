export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingAppointmentHistoryPage from '@/components/booking/BookingAppointmentHistoryPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some((perm) => perm === 'booking.appointments.view')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell px-6 py-6 lg:px-10">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/appointment-history" className="text-blue-600 hover:underline">
          Appointment History
        </Link>
      </div>
      <div className="mb-6">
        <h2 className="text-3xl font-semibold">Appointment History</h2>
        <p className="mt-1 text-sm text-slate-500">Read-only history of all booking appointment records and settlement status.</p>
      </div>
      <BookingAppointmentHistoryPage />
    </div>
  )
}
