export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import BookingQuestionPresetsPage from '@/components/booking/BookingQuestionPresetsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.permissions.includes('booking.question-presets.view')) redirect('/dashboard')
  return <div className="crm-page-shell px-10 py-6"><div className="mb-4 text-xs text-gray-500">Booking / Question Presets</div><h1 className="text-3xl font-semibold">Booking Question Presets</h1><p className="mb-6 mt-1 text-sm text-gray-500">Reusable question sets for Booking Services.</p><BookingQuestionPresetsPage permissions={user.permissions} /></div>
}
