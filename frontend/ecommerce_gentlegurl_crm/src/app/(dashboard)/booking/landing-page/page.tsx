export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingLandingPageEditor from '@/components/booking/BookingLandingPageEditor'
import { getCurrentUser } from '@/lib/auth'

export default async function BookingLandingPageSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('booking.landing-page.view')
  const canUpdate = user.permissions.includes('booking.landing-page.update')

  if (!canView && !canUpdate) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/landing-page" className="text-blue-600 hover:underline">
          Landing Page
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Edit</span>
      </div>
      <h2 className="text-3xl font-semibold mb-2">Landing Page Editor</h2>
      <p className="mb-6 text-sm text-gray-500">All changes remain local until you press Save All Changes.</p>

      <BookingLandingPageEditor canEdit={canUpdate} />
    </div>
  )
}
