export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingMyLeavePage from '@/components/booking/BookingMyLeavePage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.staff_id) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/my-leave" className="text-blue-600 hover:underline">My Leave</Link>
      </div>
      <h2 className="text-3xl font-semibold">My Leave</h2>
      <BookingMyLeavePage />
    </div>
  )
}
