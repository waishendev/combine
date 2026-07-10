export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ShopSettingsPageContent from '@/components/ShopSettingsPageContent'
import BookingPolicySettingsCard from '@/components/BookingPolicySettingsCard'
import BookingServiceNoteSettingsCard from '@/components/BookingServiceNoteSettingsCard'
import BookingReminderEmailSettingsCard from '@/components/BookingReminderEmailSettingsCard'
import BookingFeedbackEmailSettingsCard from '@/components/BookingFeedbackEmailSettingsCard'
import PaymentProofNotificationSettingsCard from '@/components/PaymentProofNotificationSettingsCard'
import BookingDepositTermsSettingsCard from '@/components/BookingDepositTermsSettingsCard'
import BookingSlotsHelpNoteSettingsCard from '@/components/BookingSlotsHelpNoteSettingsCard'
import BookingMaxAdvanceDaysSettingsCard from '@/components/BookingMaxAdvanceDaysSettingsCard'
import PosAvailabilityVerifyModeSettingsCard from '@/components/PosAvailabilityVerifyModeSettingsCard'
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
    <div className="crm-page-shell py-6 px-10">
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
        <PosAvailabilityVerifyModeSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingPolicySettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingMaxAdvanceDaysSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingServiceNoteSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingReminderEmailSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingFeedbackEmailSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <PaymentProofNotificationSettingsCard
          canEdit={canUpdate}
          settingKey="booking_payment_proof_notification"
          settingType="booking"
          title="Payment Proof Upload Notification"
          description="Notify an admin via email when a customer uploads or re-uploads a manual transfer payment slip for a booking."
        />
      </div>
      <div className="mt-6">
        <BookingDepositTermsSettingsCard canEdit={canUpdate} />
      </div>
      <div className="mt-6">
        <BookingSlotsHelpNoteSettingsCard canEdit={canUpdate} />
      </div>
    </div>
  )
}
