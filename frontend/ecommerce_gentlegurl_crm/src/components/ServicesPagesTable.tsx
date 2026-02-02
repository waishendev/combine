'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ServicesPagesDeleteModal from './ServicesPagesDeleteModal'
import { useI18n } from '@/lib/i18n'
import StatusBadge from './StatusBadge'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  page?: { id?: number; slug?: string } | null
}

type ApiResponse = {
  data?:
    | ServicesMenuItem[]
    | {
        data?: ServicesMenuItem[]
        current_page?: number
        last_page?: number
        per_page?: number
        total?: number
      }
  success?: boolean
  message?: string | null
}

function normalizeMenuItems(response: ApiResponse): ServicesMenuItem[] {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  return Array.isArray(response.data.data) ? response.data.data : []
}

export default function ServicesPagesTable({ permissions }: { permissions: string[] }) {
  const { t } = useI18n()
  const canCreate = permissions.includes('ecommerce.services-pages.create')
  const canUpdate = permissions.includes('ecommerce.services-pages.update')
  const canDelete = permissions.includes('ecommerce.services-pages.delete')

  const [items, setItems] = useState<ServicesMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServicesMenuItem | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ per_page: '200' })
        const res = await fetch(`/api/proxy/ecommerce/services-menu-items?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Failed to load services menu items.')
        }
        const json: ApiResponse = await res.json().catch(() => ({}))
        setItems(normalizeMenuItems(json))
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load services pages.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => controller.abort()
  }, [])

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items],
  )

  const handlePageDeleted = (menuId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === menuId ? { ...item, page: null } : item,
      ),
    )
  }

  return (
    <div>
      {deleteTarget && (
        <ServicesPagesDeleteModal
          servicesMenu={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(menuId) => {
            setDeleteTarget(null)
            handlePageDeleted(menuId)
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Link
              href="/services-pages/create"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Name
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Slug
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Menu Status
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                Page
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  Loading services pages...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-red-600">
                  {error}
                </td>
              </tr>
            ) : !sortedItems.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  No services menu items found.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const hasPage = Boolean(item.page?.id)
                const pageLabel = hasPage ? 'Ready' : 'Not created'
                return (
                  <tr key={item.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-2 text-gray-600">{item.slug}</td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        status={item.is_active  ? 'active' : 'inactive'}
                        label={item.is_active  ? t('common.active') : t('common.inactive')}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      <span className={hasPage ? 'text-emerald-700' : 'text-amber-600'}>{pageLabel}</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {hasPage ? (
                          canUpdate ? (
                            <Link
                              href={`/services-pages/${item.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                              aria-label="Edit services page"
                              title="Edit services page"
                            >
                              <i className="fa-solid fa-pen" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-gray-400">View only</span>
                          )
                        ) : canCreate ? (
                          <Link
                            href={`/services-pages/${item.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600"
                            aria-label="Create services page"
                            title="Create services page"
                          >
                            <i className="fa-solid fa-plus" />
                          </Link>
                        ) : (
                          <span className="text-[11px] text-gray-400">No access</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
