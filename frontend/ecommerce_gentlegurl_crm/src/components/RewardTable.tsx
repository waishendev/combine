'use client'

import { useEffect, useMemo, useState } from 'react'

import RewardRow, { type RewardRowData } from './RewardRow'
import RewardCreateModal from './RewardCreateModal'
import RewardEditModal from './RewardEditModal'
import RewardDeleteModal from './RewardDeleteModal'
import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import { mapRewardApiItemToRow, type RewardApiItem } from './rewardUtils'
import { useI18n } from '@/lib/i18n'

interface RewardTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type RewardApiResponse = {
  data?: RewardApiItem[] | {
    current_page?: number
    data?: RewardApiItem[]
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

type Filters = {
  type: '' | 'product' | 'voucher' | 'custom'
  status: '' | 'active' | 'inactive'
}

const initialFilters: Filters = {
  type: '',
  status: '',
}

export default function RewardTable({ permissions }: RewardTableProps) {
  const { t } = useI18n()
  const [filters, setFilters] = useState<Filters>({ ...initialFilters })
  const [rows, setRows] = useState<RewardRowData[]>([])
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<RewardRowData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RewardRowData | null>(null)

  const canCreate = permissions.includes('ecommerce.loyalty.rewards.create')
  const canUpdate = permissions.includes('ecommerce.loyalty.rewards.update')
  const canDelete = permissions.includes('ecommerce.loyalty.rewards.delete')
  const showActions = canUpdate || canDelete

  useEffect(() => {
    const controller = new AbortController()
    const fetchRewards = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.type) qs.set('type', filters.type)
        if (filters.status) {
          qs.set('is_active', filters.status === 'active' ? 'true' : 'false')
        }

        const res = await fetch(`/api/proxy/ecommerce/loyalty/rewards?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: RewardApiResponse = await res.json().catch(() => ({} as RewardApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let rewardItems: RewardApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            rewardItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nestedData = response.data as {
              data?: RewardApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            rewardItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list = rewardItems.map((item) => mapRewardApiItemToRow(item))

        setRows(list)
        setMeta({
          current_page: Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchRewards()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, refreshKey])

  const handleFilterChange = (key: keyof Filters, value: Filters[keyof Filters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setFilters({ ...initialFilters })
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: number) => {
    setPageSize(value)
    setCurrentPage(1)
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const tableColumns = showActions ? 8 : 7

  const activeFilters = useMemo(() => {
    const list: string[] = []
    if (filters.type) list.push(`Type: ${filters.type}`)
    if (filters.status) list.push(`Status: ${filters.status}`)
    return list
  }, [filters])

  return (
    <div>
      {isCreateModalOpen && (
        <RewardCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            handleRefresh()
          }}
        />
      )}

      {editingReward && (
        <RewardEditModal
          reward={editingReward}
          onClose={() => setEditingReward(null)}
          onSuccess={() => {
            setEditingReward(null)
            handleRefresh()
          }}
        />
      )}

      {deleteTarget && (
        <RewardDeleteModal
          reward={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            handleRefresh()
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              Create Reward
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="rewardType" className="text-sm text-gray-700">
            Type
          </label>
          <select
            id="rewardType"
            value={filters.type}
            onChange={(event) =>
              handleFilterChange('type', event.target.value as Filters['type'])
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            <option value="">All</option>
            <option value="product">Product</option>
            <option value="voucher">Voucher</option>
            <option value="custom">Custom</option>
          </select>

          <label htmlFor="rewardStatus" className="text-sm text-gray-700">
            Status
          </label>
          <select
            id="rewardStatus"
            value={filters.status}
            onChange={(event) =>
              handleFilterChange('status', event.target.value as Filters['status'])
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            <option value="">All</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>

          <button
            type="button"
            className="border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-100 disabled:opacity-50"
            onClick={handleResetFilters}
            disabled={loading}
          >
            Reset
          </button>

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
            {[15, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-gray-600">
          {activeFilters.map((filter) => (
            <span
              key={filter}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full"
            >
              {filter}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-left border border-gray-200">
          <thead>
            <tr className="bg-gray-100 text-xs uppercase text-gray-600">
              <th className="px-4 py-2 border border-gray-200">Title</th>
              <th className="px-4 py-2 border border-gray-200">Type</th>
              <th className="px-4 py-2 border border-gray-200">Reward Item</th>
              <th className="px-4 py-2 border border-gray-200">Points</th>
              <th className="px-4 py-2 border border-gray-200">Quota</th>
              <th className="px-4 py-2 border border-gray-200">Status</th>
              <th className="px-4 py-2 border border-gray-200">Sort</th>
              {showActions && (
                <th className="px-4 py-2 border border-gray-200">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && <TableLoadingRow colSpan={tableColumns} />}
            {!loading && rows.length === 0 && (
              <TableEmptyState
                colSpan={tableColumns}
                message="No rewards found."
                actionLabel={canCreate ? 'Create Reward' : undefined}
                onAction={canCreate ? () => setIsCreateModalOpen(true) : undefined}
              />
            )}
            {!loading &&
              rows.map((reward) => (
                <RewardRow
                  key={reward.id}
                  reward={reward}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={(target) => setEditingReward(target)}
                  onDelete={(target) => setDeleteTarget(target)}
                />
              ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={meta.last_page}
        pageSize={meta.per_page}
        onPageChange={setCurrentPage}
        disabled={loading}
      />
    </div>
  )
}
