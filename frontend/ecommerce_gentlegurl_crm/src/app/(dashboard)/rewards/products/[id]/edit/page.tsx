import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import ProductForm from '@/components/ProductForm'
import { mapProductApiItemToRow, type ProductApiItem } from '@/components/productUtils'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

async function getProduct(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) {
      return null
    }

    // Get cookies from request
    const ck = await cookies()
    const cookieHeader = ck
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    const res = await fetch(`${baseUrl}/api/ecommerce/products/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') return null

    // Check for unauthorized response
    if (data?.success === false && data?.message === 'Unauthorized') {
      return null
    }

    const payload = 'data' in data ? (data as { data?: ProductApiItem | null }).data : null
    return payload ? mapProductApiItemToRow(payload) : null
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function RewardProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canUpdate = user.permissions.includes('ecommerce.products.update')
  if (!canUpdate) {
    redirect('/rewards/products')
  }

  const resolvedParams = await params
  const product = await getProduct(resolvedParams.id)
  if (!product) {
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
        <span className="text-gray-700 font-medium">{t('common.edit')}</span>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/rewards/products"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="fa-solid fa-arrow-left" />
            {t('product.back')}
          </Link>
          <h2 className="text-3xl font-semibold text-gray-900">
            {t('product.editTitle')}
          </h2>
        </div>
        <p className="text-sm text-gray-600">
          {t('product.editDescription')}
        </p>
      </div>

      {/* Product Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <ProductForm
          mode="edit"
          product={product}
          redirectPath="/rewards/products"
          showCategories={false}
          showFeatured={false}
          rewardOnly
        />
      </div>
    </div>
  )
}
