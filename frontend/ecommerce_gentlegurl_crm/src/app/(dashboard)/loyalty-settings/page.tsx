export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import LoyaltySettingsForm from '@/components/LoyaltySettingsForm'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function LoyaltySettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canAccess = user.permissions.some(
    (permission) =>
      permission === 'ecommerce.loyalty.settings.create' ||
      permission === 'ecommerce.loyalty.settings.update'
  )

  if (!canAccess) {
    redirect('/dashboard')
  }

  const canUpdate = user.permissions.includes('ecommerce.loyalty.settings.update')

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>{t('Dashboard')}</span>
        <span className="mx-1">/</span>
        <Link
          href="/settings"
          className="text-blue-600 hover:underline"
        >
          Loyalty Settings
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
            Loyalty Settings
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Manage how loyalty points behave across your storefront, including multipliers, expirations, and roll-out dates.
          </p>
        </div>
      </div>

      <LoyaltySettingsForm canEdit={canUpdate} />
    </div>
  )
}

