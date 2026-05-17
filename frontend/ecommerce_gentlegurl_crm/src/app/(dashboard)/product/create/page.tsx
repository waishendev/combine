import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import ProductForm from '@/components/ProductForm'
import { mapProductApiItemToRow, type ProductApiItem } from '@/components/productUtils'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'
import type { ProductRowData } from '@/components/ProductRow'

export const dynamic = 'force-dynamic'

async function getProductRowById(id: string): Promise<ProductRowData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) {
      return null
    }

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

export default async function ProductCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string; copyId?: string | string[] }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canCreate = user.permissions.includes('ecommerce.products.create')
  if (!canCreate) {
    redirect('/product')
  }

  const sp = await searchParams
  const copyFlag = sp.copy === '1' || sp.copy === 'true'
  const copyIdRaw = sp.copyId
  const copyIdStr = Array.isArray(copyIdRaw) ? copyIdRaw[0] : copyIdRaw
  const copyId = copyIdStr && /^\d+$/.test(String(copyIdStr).trim()) ? String(copyIdStr).trim() : ''

  let copyTemplate: ProductRowData | null = null
  if (copyFlag && copyId) {
    copyTemplate = await getProductRowById(copyId)
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="crm-page-shell py-6 px-10">
      {/* Breadcrumb Navigation */}
      <div className="text-xs mb-4">
        <span className="text-gray-500">{t('sidebar.admin.management')}</span>
        <span className="mx-1 text-gray-500">/</span>
        <Link href="/product" className="text-blue-600 hover:underline">
          {t('sidebar.admin.products')}
        </Link>
        <span className="mx-1 text-gray-500">/</span>
        <span className="text-gray-700 font-medium">{t('common.create')}</span>
      </div>

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-semibold text-gray-900">
            {copyTemplate ? `Copy product: ${copyTemplate.name}` : t('product.createTitle')}
          </h2>
          <Link
            href="/product"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="fa-solid fa-arrow-left" />
            {t('product.backToProducts')}
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          {copyTemplate
            ? 'Review the pre-filled fields, make any changes, then save to create a new product. The original product is unchanged.'
            : t('product.createDescription')}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          You can also set Hide in Shop and Staff Free flags here for validation.
        </p>
        {copyFlag && copyId && !copyTemplate ? (
          <p className="mt-3 text-sm text-red-600">
            Could not load product #{copyId} to copy. You can still create a product from scratch, or check the ID
            and open{' '}
            <Link href={`/product/create?copy=1&copyId=${copyId}`} className="underline">
              this link
            </Link>{' '}
            again after fixing access.
          </p>
        ) : null}
      </div>

      {/* Product Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <ProductForm
          mode="create"
          product={null}
          copyTemplate={copyTemplate}
          redirectPath="/product"
          showBundles
        />
      </div>
    </div>
  )
}
