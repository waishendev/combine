export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import BookingStaffSchedulesPage from '@/components/booking/BookingStaffSchedulesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.schedules.view')) {
    redirect('/dashboard')
  }

  return <BookingStaffSchedulesPage permissions={user.permissions} />
}
