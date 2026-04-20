'use client'

import { useCallback, useEffect, useState } from 'react'
import PaginationControls from '../PaginationControls'
import TableLoadingRow from '../TableLoadingRow'
import TableEmptyState from '../TableEmptyState'
import { useI18n } from '@/lib/i18n'
import BookingCommissionTierCreateModal, { type CommissionTierRow } from './BookingCommissionTierCreateModal'
import BookingCommissionTierEditModal from './BookingCommissionTierEditModal'
import BookingCommissionTierDeleteModal from './BookingCommissionTierDeleteModal'

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type CommissionTierApiResponse = {
  data?: CommissionTierRow[] | {
    current_page?: number
    data?: CommissionTierRow[]
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

interface BookingCommissionTiersTableProps {
  permissions?: string[]
  tierType?: 'BOOKING' | 'ECOMMERCE'
}

export default function BookingCommissionTiersTable({
  permissions = [],
  tierType = 'BOOKING',
}: BookingCommissionTiersTableProps) {
  const { t } = useI18n()
  const [tiers, setTiers] = useState<CommissionTierRow[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<CommissionTierRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommissionTierRow | null>(null)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const canCreate = permissions.includes('booking.commission-tiers.create')
  const canUpdate = permissions.includes('booking.commission-tiers.update')
  const canDelete = permissions.includes('booking.commission-tiers.delete')
  const showActions = canUpdate || canDelete

  const fetchTiers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      qs.set('type', tierType)

      const res = await fetch(`/api/proxy/admin/booking/commission-tiers?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setError('Failed to load commission tiers.')
        setTiers([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: CommissionTierApiResponse = await res
        .json()
        .catch(() => ({} as CommissionTierApiResponse))
      
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let tierItems: CommissionTierRow[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          tierItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: CommissionTierRow[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          tierItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      setTiers(tierItems)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? tierItems.length) || tierItems.length,
      })
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError('Failed to load commission tiers.')
        setTiers([])
        setMeta((prev) => ({ ...prev, total: 0 }))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, tierType])

  useEffect(() => {
    const controller = new AbortController()
    fetchTiers(controller.signal)
    return () => controller.abort()
  }, [fetchTiers])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const totalPages = meta.last_page || 1
  const colCount = showActions ? 3 : 2

  return (
    <div>
      {isCreateModalOpen && (
        <BookingCommissionTierCreateModal
          tierType={tierType}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            setIsCreateModalOpen(false)
            await fetchTiers()
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
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
                Min Sales
              </th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Commission %
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
            ) : tiers.length > 0 ? (
              tiers.map((tier) => (
                <tr key={tier.id} className="text-sm">
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    RM {Number(tier.min_sales).toFixed(2)}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {Number(tier.commission_percent).toFixed(2)}%
                  </td>
                  {showActions && (
                    <td className="border border-gray-200 px-4 py-2">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              setEditingTier(tier)
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
                            onClick={() => setDeleteTarget(tier)}
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

      {editingTier && (
        <BookingCommissionTierEditModal
          tierType={tierType}
          tier={editingTier}
          onClose={() => setEditingTier(null)}
          onSuccess={async () => {
            setEditingTier(null)
            await fetchTiers()
          }}
        />
      )}

      {deleteTarget && (
        <BookingCommissionTierDeleteModal
          tier={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={async () => {
            setDeleteTarget(null)
            await fetchTiers()
          }}
        />
      )}

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
