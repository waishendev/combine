export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BookingQuestionPresetsTable from '@/components/booking/BookingQuestionPresetsTable'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.some(
    (perm) =>
      perm === 'booking.question_presets.view' ||
      perm === 'booking.services.view' ||
      perm === 'booking.services.update',
  )

  if (!canView) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/question-presets" className="text-blue-600 hover:underline">
          Question Presets
        </Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">Question Presets</h2>
      <BookingQuestionPresetsTable permissions={user.permissions} />
    </div>
  )
}
