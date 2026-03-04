export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import SeoSettingsForm from '@/components/SeoSettingsForm'
import { getCurrentUser } from '@/lib/auth'

export default async function BookingSeoSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canViewSeo = user.permissions.includes('booking.seo.view')
  const canUpdateSeo = user.permissions.includes('booking.seo.update') || user.permissions.includes('booking.seo.view')

  if (!canViewSeo) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>Booking</span>
        <span className="mx-1">/</span>
        <span>Shop Settings</span>
        <span className="mx-1">/</span>
        <Link href="/booking/seo-settings" className="text-blue-600 hover:underline">
          SEO Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">Global SEO Defaults</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Configure Booking storefront SEO defaults only.
          </p>
        </div>
      </div>

      <SeoSettingsForm canEdit={canUpdateSeo} forcedWorkspace="booking" />
    </div>
  )
}
