export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ProductTable from '@/components/ProductTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function RewardProductsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.products.view'
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">{t('sidebar.admin.management')}</span>
        <span className="mx-1">/</span>
        <span className="text-gray-500">Rewards</span>
        <span className="mx-1">/</span>
        <Link
          href="/rewards/products"
          className="text-blue-600 hover:underline"
        >
          {t('sidebar.admin.products')}
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">{t('product.title')}</h2>
      <ProductTable
        permissions={user.permissions}
        basePath="/rewards/products"
        rewardOnly
        showCategories={false}
      />
    </div>
  )
}
