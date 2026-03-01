export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import BookingAppointmentsPage from '@/components/booking/BookingAppointmentsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.appointments.view')) {
    redirect('/dashboard')
  }

  return <BookingAppointmentsPage permissions={user.permissions} />
}
