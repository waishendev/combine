export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ServicesMenuTable from '@/components/ServicesMenuTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function ServicesMenuPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.services-menu.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Catalog</span>
        <span className="mx-1">/</span>
        <Link
          href="/services-menu"
          className="text-blue-600 hover:underline"
        >
          {t('catalog.servicesMenu', { defaultValue: 'Services Menu' })}
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        {t('catalog.servicesMenu', { defaultValue: 'Services Menu' })}
      </h2>
      <ServicesMenuTable
        permissions={user.permissions}
      />
    </div>
  )
}
