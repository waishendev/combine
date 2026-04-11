'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'
import PromotionRow from './PromotionRow'
import PromotionFiltersWrapper from './PromotionFiltersWrapper'
import PromotionCreateModal from './PromotionCreateModal'
import PromotionEditModal from './PromotionEditModal'
import PromotionViewDrawer from './PromotionViewDrawer'
import PromotionDeleteModal from './PromotionDeleteModal'
import {
  emptyPromotionFilters,
  type PromotionFilterValues,
} from './PromotionFilters'
import {
  mapPromotionApiItemToRow,
  type PromotionApiItem,
  type PromotionRowData,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionsTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type PromotionApiResponse = {
  data?:
    | PromotionApiItem[]
    | {
        current_page?: number
        data?: PromotionApiItem[]
        last_page?: number
        per_page?: number
        total?: number
      }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function PromotionsTable({ permissions }: PromotionsTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<PromotionFilterValues>({
    ...emptyPromotionFilters,
  })
  const [filters, setFilters] = useState<PromotionFilterValues>({
    ...emptyPromotionFilters,
  })
  const [rows, setRows] = useState<PromotionRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof PromotionRowData | null>(
    null,
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null,
  )
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(
    null,
  )
  const [viewingPromotionId, setViewingPromotionId] = useState<number | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<PromotionRowData | null>(
    null,
  )

  const canCreate = permissions.includes('ecommerce.promotions.create')
  const canUpdate = permissions.includes('ecommerce.promotions.update')
  const canDelete = permissions.includes('ecommerce.promotions.delete')
  const canView = permissions.includes('ecommerce.promotions.view')
  const showActions = canView || canUpdate || canDelete

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

  const fetchPromotions = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const name = filters.name.trim()
        if (name) qs.set('search', name)

        if (filters.isActive) {
          qs.set(
            'is_active',
            filters.isActive === 'active' ? 'true' : 'false',
          )
        }

        const res = await fetch(
          `/api/proxy/ecommerce/promotions?${qs.toString()}`,
          {
            cache: 'no-store',
            signal,
          },
        )

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: PromotionApiResponse = await res
          .json()
          .catch(() => ({} as PromotionApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let items: PromotionApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            items = response.data
          } else if (
            typeof response.data === 'object' &&
            'data' in response.data
          ) {
            const nestedData = response.data as {
              data?: PromotionApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            items = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        const list = items.map((item) => mapPromotionApiItemToRow(item))

        setRows(list)

        const totalItems = list.length
        const calculatedLastPage =
          totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1

        setMeta({
          current_page:
            Number(paginationData.current_page ?? currentPage) || 1,
          last_page:
            Number(paginationData.last_page ?? calculatedLastPage) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? totalItems) || totalItems,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
        }
      } finally {
        setLoading(false)
      }
    },
    [currentPage, filters, pageSize],
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchPromotions(controller.signal)
    return () => controller.abort()
  }, [fetchPromotions])

  const handleSort = (column: keyof PromotionRowData) => {
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

    const compare = (a: PromotionRowData, b: PromotionRowData) => {
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

  const handleFilterChange = (values: PromotionFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: PromotionFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyPromotionFilters })
    setFilters({ ...emptyPromotionFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof PromotionFilterValues) => {
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

  const colCount = showActions ? 8 : 7

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof PromotionFilterValues, string][])
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof PromotionFilterValues, string> = {
    name: t('common.name'),
    isActive: t('common.status'),
  }

  const renderFilterValue = (key: keyof PromotionFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const handlePromotionCreated = (promotion: PromotionRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== promotion.id)
      const next = [promotion, ...filtered]
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

  const handlePromotionUpdated = (promotion: PromotionRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === promotion.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = promotion
      return next
    })
  }

  const handlePromotionDeleted = (promotionId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== promotionId))

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
        <PromotionFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <PromotionCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(row) => {
            setIsCreateModalOpen(false)
            handlePromotionCreated(row)
          }}
        />
      )}

      {viewingPromotionId !== null && (
        <PromotionViewDrawer
          promotionId={viewingPromotionId}
          onClose={() => setViewingPromotionId(null)}
        />
      )}

      {editingPromotionId !== null && (
        <PromotionEditModal
          promotionId={editingPromotionId}
          onClose={() => setEditingPromotionId(null)}
          onSuccess={(row) => {
            setEditingPromotionId(null)
            handlePromotionUpdated(row)
          }}
        />
      )}

      {deleteTarget && (
        <PromotionDeleteModal
          promotion={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(id) => {
            setDeleteTarget(null)
            handlePromotionDeleted(id)
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

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
            type="button"
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="promotion-page-size" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="promotion-page-size"
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
                  { key: 'name', label: t('common.name') },
                  { key: 'tierDiscountPreview', label: 'Discount' },
                  { key: 'triggerType', label: 'Trigger' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'productCount', label: 'Products' },
                  { key: 'tierCount', label: 'Tiers' },
                  { key: 'createdAt', label: 'Created' },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-1 text-left"
                    onClick={() => handleSort(key as keyof PromotionRowData)}
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
              sortedRows.map((promotion) => (
                <PromotionRow
                  key={promotion.id}
                  promotion={promotion}
                  showActions={showActions}
                  canView={canView}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onView={() => {
                    if (canView) setViewingPromotionId(promotion.id)
                  }}
                  onEdit={() => {
                    if (canUpdate) setEditingPromotionId(promotion.id)
                  }}
                  onDelete={() => {
                    if (canDelete) setDeleteTarget(promotion)
                  }}
                />
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
