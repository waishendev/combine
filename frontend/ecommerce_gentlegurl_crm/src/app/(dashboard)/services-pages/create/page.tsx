export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ServicesPageCreateForm from '@/components/ServicesPageCreateForm'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function ServicesPagesCreatePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.services-pages.create',
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
        <Link href="/services-pages" className="text-blue-600 hover:underline">
          {t('catalog.servicesPages')}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Create</span>
      </div>
      <h2 className="text-3xl font-semibold mb-2">Create Services Page</h2>
      <p className="mb-6 text-sm text-gray-500">Select the services menu item first, then continue to the editor.</p>
      <ServicesPageCreateForm permissions={user.permissions} />
    </div>
  )
}
