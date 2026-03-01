export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import BookingBlocksPage from '@/components/booking/BookingBlocksPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.blocks.view')) {
    redirect('/dashboard')
  }

  return <BookingBlocksPage permissions={user.permissions} />
}
