export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import MarqueeTable from '@/components/MarqueeTable'
import { getCurrentUser } from '@/lib/auth'

export default async function BookingMarqueePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission =
    user.permissions.includes('booking.settings.view') ||
    user.permissions.includes('booking.settings.update')

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Marketing</span>
        <span className="mx-1">/</span>
        <Link href="/booking/marquee" className="text-blue-600 hover:underline">
          Marquee
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Marquee</h2>
      <MarqueeTable permissions={user.permissions} workspaceType="booking" />
    </div>
  )
}
