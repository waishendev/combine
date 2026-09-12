 export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import BranchNotificationSettingsForm from '@/components/BranchNotificationSettingsForm'
import { getCurrentUser } from '@/lib/auth'

export default async function EmailNotificationSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const canView = user.permissions.includes('ecommerce.settings.view') || user.permissions.includes('booking.settings.view')
  const canEdit = user.permissions.includes('ecommerce.settings.update') || user.permissions.includes('booking.settings.update')
  if (!canView && !canEdit) redirect('/dashboard')

  return (
    <div className="crm-page-shell px-4 py-6 sm:px-6 lg:px-10">
      <div className="mb-4 flex items-center text-xs text-gray-500">
        <span>Settings</span>
        <span className="mx-1">/</span>
        <Link href="/settings/email-notifications" className="text-blue-600 hover:underline">
          Email / Notifications
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-semibold leading-tight text-slate-900">Email / Notifications</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Configure booking email schedules and operational notification recipients for the Branch selected in the Header.
          SMTP sender settings remain global. Ecommerce Payment Proof stays under Shop Settings → General Settings.
        </p>
      </div>

      <BranchNotificationSettingsForm canEdit={canEdit} />
    </div>
  )
}
