'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ServicesPagesDeleteModal from './ServicesPagesDeleteModal'

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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Services Pages</h3>
          <p className="text-xs text-gray-500">Pick a services menu and manage its page.</p>
        </div>
        {canCreate ? (
          <Link
            href="/services-pages/create"
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <i className="fa-solid fa-plus" />
            Create Page
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="px-5 py-10 text-sm text-gray-500">Loading services pages...</div>
      ) : error ? (
        <div className="px-5 py-10 text-sm text-red-600">{error}</div>
      ) : !sortedItems.length ? (
        <div className="px-5 py-10 text-sm text-gray-500">No services menu items found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Name</th>
                <th className="px-5 py-3 text-left font-semibold">Slug</th>
                <th className="px-5 py-3 text-left font-semibold">Menu Status</th>
                <th className="px-5 py-3 text-left font-semibold">Page</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedItems.map((item) => {
                const hasPage = Boolean(item.page?.id)
                const pageLabel = hasPage ? 'Ready' : 'Not created'
                return (
                  <tr key={item.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-5 py-3 text-gray-600">{item.slug}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <span className={hasPage ? 'text-emerald-700' : 'text-amber-600'}>{pageLabel}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {hasPage ? (
                          <>
                            {canUpdate ? (
                              <Link
                                href={`/services-pages/${item.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-700 hover:border-blue-200 hover:text-blue-700"
                                aria-label="Edit services page"
                                title="Edit services page"
                              >
                                <i className="fa-solid fa-pen" />
                              </Link>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-red-600 hover:border-red-200 hover:text-red-700"
                                aria-label="Delete services page"
                                title="Delete services page"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            ) : null}
                            {!canUpdate && !canDelete ? (
                              <span className="text-[11px] text-gray-400">View only</span>
                            ) : null}
                          </>
                        ) : canCreate ? (
                          <Link
                            href={`/services-pages/${item.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-700 hover:border-blue-200 hover:text-blue-700"
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
