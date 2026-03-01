export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import BookingAppointmentDetailPage from '@/components/booking/BookingAppointmentDetailPage'
import { getCurrentUser } from '@/lib/auth'

type Props = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.appointments.view')) {
    redirect('/dashboard')
  }

  const { id } = await params

  return <BookingAppointmentDetailPage bookingId={id} permissions={user.permissions} />
}
