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
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/landing-page" className="text-blue-600 hover:underline">
          Landing Page
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">Landing Page Editor</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Manage the booking shop home page sections: Hero, Gallery, Service Menu, FAQ, and Policy Notes.
          </p>
        </div>
      </div>

      <BookingLandingPageEditor canEdit={canUpdate} />
    </div>
  )
}
