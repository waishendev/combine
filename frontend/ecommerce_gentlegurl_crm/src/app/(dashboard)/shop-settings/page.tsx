export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ShopSettingsPageContent from '@/components/ShopSettingsPageContent'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function ShopSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('ecommerce.settings.view')
  const canUpdate = user.permissions.includes('ecommerce.settings.update')

  if (!canView && !canUpdate) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>{t('Dashboard')}</span>
        <span className="mx-1">/</span>
        <Link
          href="/shop-settings"
          className="text-blue-600 hover:underline"
        >
          Shop Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Ecommerce</p>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">Shop Settings</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Manage storefront widgets and homepage product windows shown to shoppers.
          </p>
        </div>
      </div>

      <ShopSettingsPageContent canEdit={canUpdate} />
    </div>
  )
}
