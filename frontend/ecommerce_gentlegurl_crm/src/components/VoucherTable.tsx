'use client'

import { useEffect, useMemo, useState } from 'react'

import VoucherFiltersWrapper from './VoucherFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import VoucherRow, { VoucherRowData } from './VoucherRow'
import {
  VoucherFilterValues,
  emptyVoucherFilters,
} from './VoucherFilters'
import VoucherCreateModal from './VoucherCreateModal'
import VoucherEditModal from './VoucherEditModal'
import VoucherDeleteModal from './VoucherDeleteModal'
import {
  type VoucherApiItem,
  mapVoucherApiItemToRow,
} from './voucherUtils'
import { useI18n } from '@/lib/i18n'

interface VoucherTableProps {
  permissions: string[]
  isRewardOnly?: boolean
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type VoucherApiResponse = {
  data?: VoucherApiItem[] | {
    current_page?: number
    data?: VoucherApiItem[]
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

export default function VoucherTable({
  permissions,
  isRewardOnly,
}: VoucherTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<VoucherFilterValues>({ ...emptyVoucherFilters })
  const [filters, setFilters] = useState<VoucherFilterValues>({ ...emptyVoucherFilters })
  const [rows, setRows] = useState<VoucherRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof VoucherRowData | null>(
    'code',
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    'asc',
  )
  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VoucherRowData | null>(null)

  const canCreate = permissions.includes('ecommerce.vouchers.create')
  const canUpdate = permissions.includes('ecommerce.vouchers.update')
  const canDelete = permissions.includes('ecommerce.vouchers.delete')
  const showActions = canUpdate || canDelete

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  function DualSortIcons({
    active,
    dir,
    className = 'ml-1',
  }: {
    active: boolean
    dir: 'asc' | 'desc' | null
    className?: string
  }) {
    const activeColor = '#122350ff'
    const inactiveColor = '#afb2b8ff'
    const up = active && dir === 'asc' ? activeColor : inactiveColor
    const down = active && dir === 'desc' ? activeColor : inactiveColor

    return (
      <svg
        className={`${className} inline-block align-middle`}
        width="15"
        height="15"
        viewBox="0 0 10 12"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 1 L9 5 H1 Z" fill={up} />
        <path d="M5 11 L1 7 H9 Z" fill={down} />
      </svg>
    )
  }

  useEffect(() => {
    const controller = new AbortController()
    const fetchVouchers = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.code) qs.set('code', filters.code)
        if (filters.isActive) {
          qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
        }
        if (isRewardOnly !== undefined) {
          qs.set('is_reward_only', String(isRewardOnly))
        }

        const res = await fetch(`/api/proxy/ecommerce/vouchers?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: VoucherApiResponse = await res
          .json()
          .catch(() => ({} as VoucherApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let voucherItems: VoucherApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            voucherItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: VoucherApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            voucherItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        // Fallback to meta if available
        if (response?.meta) {
          paginationData = { ...paginationData, ...response.meta }
        }

        const list: VoucherRowData[] = voucherItems.map((item) => mapVoucherApiItemToRow(item))

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

    fetchVouchers()
    return () => controller.abort()
  }, [filters, currentPage, pageSize])

  const handleSort = (column: keyof VoucherRowData) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return rows

    const compare = (a: VoucherRowData, b: VoucherRowData) => {
      const valueA = a[sortColumn]
      const valueB = b[sortColumn]

      const normalize = (value: unknown) => {
        if (value == null) return ''
        if (typeof value === 'string') return value.toLowerCase()
        if (typeof value === 'number') return value
        if (typeof value === 'boolean') return value ? 1 : 0
        return value
      }

      const normalizedA = normalize(valueA)
      const normalizedB = normalize(valueB)

      if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
        return normalizedA - normalizedB
      }

      return String(normalizedA).localeCompare(String(normalizedB))
    }

    const sorted = [...rows].sort(compare)
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [rows, sortColumn, sortDirection])

  const handleFilterChange = (values: VoucherFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: VoucherFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyVoucherFilters })
    setFilters({ ...emptyVoucherFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof VoucherFilterValues) => {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const hideMaxUsesPerCustomer = Boolean(isRewardOnly)
  const colCount = showActions
    ? hideMaxUsesPerCustomer ? 8 : 9
    : hideMaxUsesPerCustomer ? 7 : 8

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof VoucherFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof VoucherFilterValues, string> = {
    code: 'Code',
    isActive: t('common.status'),
  }

  const renderFilterValue = (key: keyof VoucherFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const handleVoucherCreated = (voucher: VoucherRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== voucher.id)
      const next = [voucher, ...filtered]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = (prevMeta.total || 0) + 1
      const last_page = Math.max(
        prevMeta.last_page || 1,
        Math.ceil(total / perPage),
      )

      return {
        ...prevMeta,
        total,
        last_page,
      }
    })
  }

  const handleVoucherUpdated = (voucher: VoucherRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === voucher.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = voucher
      return next
    })
  }

  const handleVoucherDeleted = (voucherId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== voucherId))

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = Math.max((prevMeta.total || 0) - 1, 0)
      const last_page = Math.max(1, Math.ceil(total / perPage))
      const nextMeta: Meta = {
        ...prevMeta,
        total,
        last_page,
        current_page: Math.min(prevMeta.current_page || 1, last_page),
      }

      if ((prevMeta.current_page || 1) > last_page) {
        setCurrentPage(last_page)
      }

      return nextMeta
    })
  }

  return (
    <div>
      {isFilterModalOpen && (
        <VoucherFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <VoucherCreateModal
          isRewardOnly={isRewardOnly}
          hideMaxUsesPerCustomer={hideMaxUsesPerCustomer}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(voucher) => {
            setIsCreateModalOpen(false)
            handleVoucherCreated(voucher)
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
              Create Voucher
            </button>
          )}

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>
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

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
            >
              <span className="font-medium">{filterLabels[key]}</span>
              <span>{renderFilterValue(key, value)}</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleBadgeRemove(key)}
                aria-label={`${t('common.removeFilter')} ${filterLabels[key]}`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {(
                [
                  { key: 'code', label: 'Code' },
                  { key: 'value', label: 'Value' },
                  { key: 'minOrderAmount', label: 'Min Order Amount' },
                  { key: 'maxUses', label: 'Max Uses' },
                  ...(!hideMaxUsesPerCustomer
                    ? [{ key: 'maxUsesPerCustomer', label: 'Max Uses Per Customer' } as const]
                    : []),
                  { key: 'startAt', label: 'Start Date' },
                  { key: 'endAt', label: 'End Date' },
                  { key: 'isActive', label: t('common.status') },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key)}
                  >
                    <span>{label}</span>
                    <DualSortIcons
                      active={sortColumn === key && sortDirection !== null}
                      dir={sortColumn === key ? sortDirection : null}
                    />
                  </button>
                </th>
              ))}
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
              sortedRows.map((voucher) => (
                <VoucherRow
                  key={voucher.id}
                  voucher={voucher}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  hideMaxUsesPerCustomer={hideMaxUsesPerCustomer}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingVoucherId(voucher.id)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(voucher)
                    }
                  }}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingVoucherId !== null && (
        <VoucherEditModal
          voucherId={editingVoucherId}
          isRewardOnly={isRewardOnly}
          hideMaxUsesPerCustomer={hideMaxUsesPerCustomer}
          onClose={() => setEditingVoucherId(null)}
          onSuccess={(voucher) => {
            setEditingVoucherId(null)
            handleVoucherUpdated(voucher)
          }}
        />
      )}

      {deleteTarget && (
        <VoucherDeleteModal
          voucher={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(voucherId) => {
            setDeleteTarget(null)
            handleVoucherDeleted(voucherId)
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
