export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import BookingServicesPage from '@/components/booking/BookingServicesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.services.view')) {
    redirect('/dashboard')
  }

  return <BookingServicesPage permissions={user.permissions} />
}
