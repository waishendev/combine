'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PaginationControls from '../PaginationControls'
import TableLoadingRow from '../TableLoadingRow'
import TableEmptyState from '../TableEmptyState'
import { useI18n } from '@/lib/i18n'

type ServicePackageItem = {
  id: number
  booking_service_id: number
  quantity: number
  booking_service?: {
    id: number
    name: string
  }
}

type ServicePackage = {
  id: number
  name: string
  description?: string | null
  selling_price: number
  total_sessions: number
  valid_days?: number | null
  is_active: boolean
  items?: ServicePackageItem[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ServicePackageApiResponse = {
  data?: ServicePackage[] | {
    current_page?: number
    data?: ServicePackage[]
    last_page?: number
    per_page?: number
    total?: number
    from?: number
    to?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

interface ServicePackagesPageProps {
  permissions?: string[]
}

export default function ServicePackagesPage({ permissions = [] }: ServicePackagesPageProps) {
  const { t } = useI18n()
  const [rows, setRows] = useState<ServicePackage[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const canCreate = permissions.includes('service-packages.create')
  const canUpdate = permissions.includes('service-packages.update')
  const canDelete = permissions.includes('service-packages.delete')
  const showActions = canUpdate || canDelete

  const fetchPackages = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const res = await fetch(`/api/proxy/service-packages?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: ServicePackageApiResponse = await res
        .json()
        .catch(() => ({} as ServicePackageApiResponse))
      
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let packageItems: ServicePackage[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          packageItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: ServicePackage[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          packageItems = Array.isArray(nestedData.data) ? nestedData.data : []
          paginationData = {
            current_page: nestedData.current_page,
            last_page: nestedData.last_page,
            per_page: nestedData.per_page,
            total: nestedData.total,
          }
        }
      }

      if (response?.meta) {
        paginationData = { ...paginationData, ...response.meta }
      }

      setRows(packageItems)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? packageItems.length) || packageItems.length,
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    fetchPackages(controller.signal)
    return () => controller.abort()
  }, [fetchPackages])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const totalPages = meta.last_page || 1
  const colCount = showActions ? 6 : 5

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => {
                // TODO: Open create modal
                alert('Create modal - to be implemented')
              }}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Price
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Sessions
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Status
              </th>
              {showActions && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              rows.map((pkg) => (
                <tr key={pkg.id} className="text-sm">
                  <td className="border border-gray-200 px-4 py-2 font-medium text-gray-900">
                    {pkg.name}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {pkg.description || '-'}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    RM {Number(pkg.selling_price).toFixed(2)}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {pkg.total_sessions}
                    {pkg.valid_days && ` (${pkg.valid_days} days)`}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      pkg.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pkg.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  {showActions && (
                    <td className="border border-gray-200 px-4 py-2">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              // TODO: Open edit modal
                              alert(`Edit package ${pkg.id} - to be implemented`)
                            }}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={async () => {
                              if (!window.confirm('Delete this service package?')) return
                              const res = await fetch(`/api/proxy/service-packages/${pkg.id}`, { method: 'DELETE' })
                              if (res.ok) {
                                await fetchPackages()
                              }
                            }}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />
    </div>
  )
}
