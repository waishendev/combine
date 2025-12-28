import Link from 'next/link'
import { redirect } from 'next/navigation'

import ProductForm from '@/components/ProductForm'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function RewardProductCreatePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canCreate = user.permissions.includes('ecommerce.products.create')
  if (!canCreate) {
    redirect('/rewards/products')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      {/* Breadcrumb Navigation */}
      <div className="text-xs mb-4">
        <span className="text-gray-500">{t('sidebar.admin.management')}</span>
        <span className="mx-1 text-gray-500">/</span>
        <span className="text-gray-500">Rewards</span>
        <span className="mx-1 text-gray-500">/</span>
        <Link href="/rewards/products" className="text-blue-600 hover:underline">
          {t('sidebar.admin.products')}
        </Link>
        <span className="mx-1 text-gray-500">/</span>
        <span className="text-gray-700 font-medium">{t('common.create')}</span>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-semibold text-gray-900">
            {t('product.createTitle')}
          </h2>
          <Link
            href="/rewards/products"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="fa-solid fa-arrow-left" />
            {t('product.backToProducts')}
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          {t('product.createDescription')}
        </p>
      </div>

      {/* Product Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <ProductForm
          mode="create"
          product={null}
          redirectPath="/rewards/products"
          showCategories={false}
          showFeatured={false}
          rewardOnly
        />
      </div>
    </div>
  )
}
