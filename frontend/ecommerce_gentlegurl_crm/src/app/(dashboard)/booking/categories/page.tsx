export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingServiceCategoriesPage from '@/components/booking/BookingServiceCategoriesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.some((perm) => perm === 'booking.services.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/categories" className="text-blue-600 hover:underline">Categories</Link>
      </div>
      <h2 className="text-3xl font-semibold">Booking Service Categories</h2>
      <BookingServiceCategoriesPage />
    </div>
  )
}
