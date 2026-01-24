export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ServicesPagesEditor from '@/components/ServicesPagesEditor'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function ServicesPagesDetailPage({
  params,
}: {
  params: Promise<{ menuId: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.services-pages.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const { menuId } = await params
  const numericMenuId = Number(menuId)
  if (!Number.isFinite(numericMenuId)) {
    redirect('/services-pages')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Catalog</span>
        <span className="mx-1">/</span>
        <Link href="/services-pages" className="text-blue-600 hover:underline">
          {t('catalog.servicesPages', { defaultValue: 'Services Pages' })}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Edit</span>
      </div>
      <h2 className="text-3xl font-semibold mb-2">Edit Services Page</h2>
      <p className="mb-6 text-sm text-gray-500">All changes remain local until you press Save All Changes.</p>
      <ServicesPagesEditor permissions={user.permissions} menuId={numericMenuId} />
    </div>
  )
}
