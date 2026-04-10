export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import PromotionsTable from '@/components/promotions/PromotionsTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function PromotionsPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (!user.permissions.includes('ecommerce.promotions.view')) redirect('/dashboard')

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Marketing</span>
        <span className="mx-1">/</span>
        <Link href="/promotions" className="text-blue-600 hover:underline">
          {t('marketing.promotions')}
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">{t('marketing.promotions')}</h2>
      <PromotionsTable permissions={user.permissions} />
    </div>
  )
}
