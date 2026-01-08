import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

import StoreDetailActions from '@/components/StoreDetailActions'
import { mapStoreApiItemToRow, type StoreApiItem } from '@/components/storeUtils'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

async function getStore(id: string) {
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

    const res = await fetch(`${baseUrl}/api/ecommerce/store-locations/${id}`, {
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

    const payload = 'data' in data ? (data as { data?: StoreApiItem | null }).data : null
    return payload ? mapStoreApiItemToRow(payload) : null
  } catch (error) {
    console.error(error)
    return null
  }
}

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('ecommerce.stores.view')
  if (!canView) {
    redirect('/store')
  }
  const canUpdate = user.permissions.includes('ecommerce.stores.update')

  const resolvedParams = await params
  const store = await getStore(resolvedParams.id)
  if (!store) {
    redirect('/store')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Catalog</span>
        <span className="mx-1">/</span>
        <Link href="/store" className="text-blue-600 hover:underline">
          Stores
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700 font-medium">Store Details</span>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <Link
              href="/store"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <i className="fa-solid fa-arrow-left" />
              Back
            </Link>
            <h2 className="text-3xl font-semibold text-gray-900">{store.name}</h2>
          </div>
          <StoreDetailActions storeId={store.id} canUpdate={canUpdate} />
        </div>
        <p className="text-sm text-gray-600">Code: {store.code}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Photos</h3>
            <span className="text-xs text-gray-500">{store.images?.length ?? 0}/6</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {store.images && store.images.length > 0 ? (
              store.images.map((image) => (
                <div
                  key={image.id}
                  className="h-28 w-full rounded-lg border border-gray-200 overflow-hidden"
                >
                  <img
                    src={image.imageUrl}
                    alt={store.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="col-span-2 text-sm text-gray-400">
                No photos uploaded.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Address Line 1</p>
              <p className="text-sm text-gray-900">{store.address_line1}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Address Line 2</p>
              <p className="text-sm text-gray-900">{store.address_line2 || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">City</p>
              <p className="text-sm text-gray-900">{store.city}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">State</p>
              <p className="text-sm text-gray-900">{store.state}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Postcode</p>
              <p className="text-sm text-gray-900">{store.postcode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Country</p>
              <p className="text-sm text-gray-900">{store.country}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm text-gray-900">{store.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm text-gray-900">
                {store.isActive ? t('common.active') : t('common.inactive')}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Opening Hours</p>
            {store.openingHours && store.openingHours.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-900">
                {store.openingHours.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No opening hours provided.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
