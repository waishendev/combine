export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingOffDayGenerationsPage from '@/components/booking/BookingOffDayGenerationsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('booking.off_day_generations.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell px-4 py-4 sm:px-10 sm:py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/leave-calendar" className="text-gray-500 hover:text-blue-600 hover:underline">
          Leave Calendar
        </Link>
        <span className="mx-1">/</span>
        <Link href="/booking/off-day-generations" className="text-blue-600 hover:underline">
          Off Day Generations
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold sm:text-3xl">Off Day Generations</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            One row per Generate batch. Revert only cancels that batch — manual off days stay untouched.
          </p>
        </div>
        <Link
          href="/booking/leave-calendar"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:min-h-0"
        >
          <i className="fa-solid fa-calendar-days" />
          Open Leave Calendar
        </Link>
      </div>

      <BookingOffDayGenerationsPage permissions={user.permissions} />
    </div>
  )
}
