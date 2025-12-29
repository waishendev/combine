'use client'

import { useEffect, useMemo, useState } from 'react'

import MarqueeFiltersWrapper from './MarqueeFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import MarqueeRow, { MarqueeRowData } from './MarqueeRow'
import {
  MarqueeFilterValues,
  emptyMarqueeFilters,
} from './MarqueeFilters'
import MarqueeCreateModal from './MarqueeCreateModal'
import MarqueeEditModal from './MarqueeEditModal'
import MarqueeDeleteModal from './MarqueeDeleteModal'
import {
  type MarqueeApiItem,
  mapMarqueeApiItemToRow,
} from './marqueeUtils'
import { useI18n } from '@/lib/i18n'

interface MarqueeTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type MarqueeApiResponse = {
  data?: MarqueeApiItem[] | {
    current_page?: number
    data?: MarqueeApiItem[]
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

export default function MarqueeTable({
  permissions,
}: MarqueeTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<MarqueeFilterValues>({ ...emptyMarqueeFilters })
  const [filters, setFilters] = useState<MarqueeFilterValues>({ ...emptyMarqueeFilters })
  const [rows, setRows] = useState<MarqueeRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof MarqueeRowData | null>(
    'text',
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    'asc',
  )
  const [editingMarqueeId, setEditingMarqueeId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MarqueeRowData | null>(null)
  const [movingMarqueeId, setMovingMarqueeId] = useState<number | null>(null)

  const canCreate = permissions.includes('ecommerce.marquees.create')
  const canUpdate = permissions.includes('ecommerce.marquees.update')
  const canDelete = permissions.includes('ecommerce.marquees.delete')
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
    const fetchMarquees = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.text) qs.set('text', filters.text)
        if (filters.isActive) {
          qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
        }

        const res = await fetch(`/api/proxy/ecommerce/marquees?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: MarqueeApiResponse = await res
          .json()
          .catch(() => ({} as MarqueeApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let marqueeItems: MarqueeApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            marqueeItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: MarqueeApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            marqueeItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: MarqueeRowData[] = marqueeItems.map((item) => mapMarqueeApiItemToRow(item))

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

    fetchMarquees()
    return () => controller.abort()
  }, [filters, currentPage, pageSize])

  const handleSort = (column: keyof MarqueeRowData) => {
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

    const compare = (a: MarqueeRowData, b: MarqueeRowData) => {
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

  const handleFilterChange = (values: MarqueeFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: MarqueeFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyMarqueeFilters })
    setFilters({ ...emptyMarqueeFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof MarqueeFilterValues) => {
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
    return (Object.entries(filters) as [keyof MarqueeFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof MarqueeFilterValues, string> = {
    text: 'Text',
    isActive: t('common.status'),
  }

  const renderFilterValue = (key: keyof MarqueeFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const handleMarqueeCreated = (marquee: MarqueeRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== marquee.id)
      const next = [marquee, ...filtered]
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

  const handleMarqueeUpdated = (marquee: MarqueeRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === marquee.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = marquee
      return next
    })
  }

  const handleMarqueeDeleted = (marqueeId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== marqueeId))

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

  const handleMoveUp = async (marquee: MarqueeRowData) => {
    if (movingMarqueeId === marquee.id) return
    setMovingMarqueeId(marquee.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/marquees/${marquee.id}/move-up`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
        },
      )

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        console.error('Failed to move marquee up')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.text) qs.set('text', filters.text)
      if (filters.isActive) {
        qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
      }

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/marquees?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: MarqueeApiResponse = await refreshRes
          .json()
          .catch(() => ({} as MarqueeApiResponse))

        let marqueeItems: MarqueeApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            marqueeItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: MarqueeApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            marqueeItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        if (refreshResponse?.meta) {
          paginationData = { ...paginationData, ...refreshResponse.meta }
        }

        const list: MarqueeRowData[] = marqueeItems.map((item) =>
          mapMarqueeApiItemToRow(item),
        )

        setRows(list)
        setMeta({
          current_page:
            Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setMovingMarqueeId(null)
    }
  }

  const handleMoveDown = async (marquee: MarqueeRowData) => {
    if (movingMarqueeId === marquee.id) return
    setMovingMarqueeId(marquee.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/marquees/${marquee.id}/move-down`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
        },
      )

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        console.error('Failed to move marquee down')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.text) qs.set('text', filters.text)
      if (filters.isActive) {
        qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
      }

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/marquees?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: MarqueeApiResponse = await refreshRes
          .json()
          .catch(() => ({} as MarqueeApiResponse))

        let marqueeItems: MarqueeApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            marqueeItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: MarqueeApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            marqueeItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        if (refreshResponse?.meta) {
          paginationData = { ...paginationData, ...refreshResponse.meta }
        }

        const list: MarqueeRowData[] = marqueeItems.map((item) =>
          mapMarqueeApiItemToRow(item),
        )

        setRows(list)
        setMeta({
          current_page:
            Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setMovingMarqueeId(null)
    }
  }

  return (
    <div>
      {isFilterModalOpen && (
        <MarqueeFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <MarqueeCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(marquee) => {
            setIsCreateModalOpen(false)
            handleMarqueeCreated(marquee)
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
              Create Marquee
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
                  { key: 'text', label: 'Text' },
                  { key: 'startAt', label: 'Start Date' },
                  { key: 'endAt', label: 'End Date' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'sortOrder', label: 'Sort Order' },
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
              (() => {
                // Determine first and last based on sortOrder values in current page
                const sortOrders = rows
                  .map((r) => r.sortOrder)
                  .filter((so): so is number => so !== null)
                const minSortOrder =
                  sortOrders.length > 0 ? Math.min(...sortOrders) : null
                const maxSortOrder =
                  sortOrders.length > 0 ? Math.max(...sortOrders) : null

                return sortedRows.map((marquee) => {
                  const isFirst =
                    marquee.sortOrder !== null &&
                    marquee.sortOrder === minSortOrder
                  const isLast =
                    marquee.sortOrder !== null &&
                    marquee.sortOrder === maxSortOrder

                  return (
                    <MarqueeRow
                      key={marquee.id}
                      marquee={marquee}
                      showActions={showActions}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      isFirst={isFirst}
                      isLast={isLast}
                      onEdit={() => {
                        if (canUpdate) {
                          setEditingMarqueeId(marquee.id)
                        }
                      }}
                      onDelete={() => {
                        if (canDelete) {
                          setDeleteTarget(marquee)
                        }
                      }}
                      onMoveUp={() => {
                        if (canUpdate) {
                          handleMoveUp(marquee)
                        }
                      }}
                      onMoveDown={() => {
                        if (canUpdate) {
                          handleMoveDown(marquee)
                        }
                      }}
                    />
                  )
                })
              })()
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingMarqueeId !== null && (
        <MarqueeEditModal
          marqueeId={editingMarqueeId}
          onClose={() => setEditingMarqueeId(null)}
          onSuccess={(marquee) => {
            setEditingMarqueeId(null)
            handleMarqueeUpdated(marquee)
          }}
        />
      )}

      {deleteTarget && (
        <MarqueeDeleteModal
          marquee={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(marqueeId) => {
            setDeleteTarget(null)
            handleMarqueeDeleted(marqueeId)
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

