export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import DailyBookingPageClient from '@/components/daily-booking/DailyBookingPageClient'
import { getCurrentUser } from '@/lib/auth'

export default async function DailyBookingPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('pos.checkout') || user.permissions.includes('booking.appointments.view')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell min-h-0 px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 xl:px-10">
      <DailyBookingPageClient />
    </div>
  )
}
