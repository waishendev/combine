export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ShopSettingsPageContent from '@/components/ShopSettingsPageContent'
import BookingPolicySettingsCard from '@/components/BookingPolicySettingsCard'
import { getCurrentUser } from '@/lib/auth'

export default async function BookingShopSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('booking.settings.view')
  const canUpdate = user.permissions.includes('booking.settings.update') || user.permissions.includes('booking.settings.view')

  if (!canView && !canUpdate) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>Booking</span>
        <span className="mx-1">/</span>
        <span>Shop Settings</span>
        <span className="mx-1">/</span>
        <Link href="/booking/general-settings" className="text-blue-600 hover:underline">
          General Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">General Settings</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Manage booking storefront settings. Changes here only affect Booking workspace.
          </p>
        </div>
      </div>

      <ShopSettingsPageContent canEdit={canUpdate} forcedWorkspace="booking" />
      <div className="mt-6">
        <BookingPolicySettingsCard canEdit={canUpdate} />
      </div>
    </div>
  )
}
