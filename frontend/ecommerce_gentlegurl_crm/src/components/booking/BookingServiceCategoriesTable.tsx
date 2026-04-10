'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import PaginationControls from '@/components/PaginationControls'
import BookingServiceCategoryRow, {
  type BookingServiceCategoryRowData,
} from './BookingServiceCategoryRow'
import BookingServiceCategoryCreateModal from './BookingServiceCategoryCreateModal'
import BookingServiceCategoryEditModal from './BookingServiceCategoryEditModal'
import BookingServiceCategoryDeleteModal from './BookingServiceCategoryDeleteModal'
import {
  mapBookingServiceCategoryApiItemToRow,
  type BookingServiceCategoryApiItem,
} from './bookingServiceCategoryUtils'
import { useI18n } from '@/lib/i18n'

interface BookingServiceCategoriesTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type CategoriesApiResponse = {
  data?: BookingServiceCategoryApiItem[] | {
    current_page?: number
    data?: BookingServiceCategoryApiItem[]
    last_page?: number
    per_page?: number
    total?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function BookingServiceCategoriesTable({ permissions }: BookingServiceCategoriesTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<BookingServiceCategoryRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof BookingServiceCategoryRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BookingServiceCategoryRowData | null>(null)
  const [movingCategoryId, setMovingCategoryId] = useState<number | null>(null)

  const canCreate = permissions.includes('booking.services.create')
  const canUpdate = permissions.includes('booking.services.update')
  const canDelete = permissions.includes('booking.services.delete')
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

  const refreshList = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/admin/booking/categories?${qs.toString()}`, {
          cache: 'no-store',
          signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: CategoriesApiResponse = await res.json().catch(() => ({}))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let items: BookingServiceCategoryApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            items = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nested = response.data as {
              data?: BookingServiceCategoryApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            items = Array.isArray(nested.data) ? nested.data : []
            paginationData = {
              current_page: nested.current_page,
              last_page: nested.last_page,
              per_page: nested.per_page,
              total: nested.total,
            }
          }
        }
        if (response?.meta) {
          paginationData = { ...paginationData, ...response.meta }
        }

        const list = items.map((item) => mapBookingServiceCategoryApiItemToRow(item))
        setRows(list)
        setMeta({
          current_page: Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
        }
      } finally {
        setLoading(false)
      }
    },
    [currentPage, pageSize],
  )

  useEffect(() => {
    const controller = new AbortController()
    void refreshList(controller.signal)
    return () => controller.abort()
  }, [refreshList])

  const handleSort = (column: keyof BookingServiceCategoryRowData) => {
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

    const compare = (a: BookingServiceCategoryRowData, b: BookingServiceCategoryRowData) => {
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

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const colCount = showActions ? 5 : 4
  const totalPages = meta.last_page || 1

  const handleCategoryCreated = (category: BookingServiceCategoryRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== category.id)
      const next = [category, ...filtered]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })
    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = (prevMeta.total || 0) + 1
      const last_page = Math.max(prevMeta.last_page || 1, Math.ceil(total / perPage))
      return { ...prevMeta, total, last_page }
    })
  }

  const handleCategoryUpdated = (category: BookingServiceCategoryRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === category.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = category
      return next
    })
  }

  const handleCategoryDeleted = (categoryId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== categoryId))
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

  /** Update list in-memory after move-up/down — no full refetch (avoids loading flash). */
  const swapAdjacentInRows = (
    prev: BookingServiceCategoryRowData[],
    categoryId: number,
    direction: 'up' | 'down',
  ): BookingServiceCategoryRowData[] | null => {
    const idx = prev.findIndex((r) => r.id === categoryId)
    if (idx === -1) return null
    const next = [...prev]
    if (direction === 'up') {
      if (idx === 0) return null
      const j = idx - 1
      const a = next[idx]
      const b = next[j]
      next[j] = { ...a, sortOrder: b.sortOrder }
      next[idx] = { ...b, sortOrder: a.sortOrder }
      return next
    }
    if (idx >= next.length - 1) return null
    const j = idx + 1
    const a = next[idx]
    const b = next[j]
    next[idx] = { ...b, sortOrder: a.sortOrder }
    next[j] = { ...a, sortOrder: b.sortOrder }
    return next
  }

  const runMove = async (method: 'move-up' | 'move-down', category: BookingServiceCategoryRowData) => {
    if (movingCategoryId === category.id) return
    setMovingCategoryId(category.id)
    const direction = method === 'move-up' ? 'up' : 'down'
    try {
      const res = await fetch(`/api/proxy/admin/booking/categories/${category.id}/${method}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object' && data?.success === false && data?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }
      if (!res.ok) return
      setRows((prev) => swapAdjacentInRows(prev, category.id, direction) ?? prev)
    } catch {
      /* ignore */
    } finally {
      setMovingCategoryId(null)
    }
  }

  return (
    <div>
      {isCreateModalOpen && (
        <BookingServiceCategoryCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(category) => {
            setIsCreateModalOpen(false)
            handleCategoryCreated(category)
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
          <label htmlFor="categoryPageSize" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="categoryPageSize"
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
              {(
                [
                  { key: 'name', label: 'Name' },
                  { key: 'slug', label: 'Slug' },
                  { key: 'sortOrder', label: 'Sort Order' },
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
              (() => {
                const sortOrders = sortedRows
                  .map((r) => r.sortOrder)
                  .filter((so): so is number => so !== null)
                const minSortOrder = sortOrders.length > 0 ? Math.min(...sortOrders) : null
                const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : null

                return sortedRows.map((category) => {
                  const isFirst =
                    category.sortOrder !== null && category.sortOrder === minSortOrder
                  const isLast =
                    category.sortOrder !== null && category.sortOrder === maxSortOrder

                  return (
                    <BookingServiceCategoryRow
                      key={category.id}
                      category={category}
                      showActions={showActions}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      isFirst={isFirst}
                      isLast={isLast}
                      onEdit={() => {
                        if (canUpdate) setEditingCategoryId(category.id)
                      }}
                      onDelete={() => {
                        if (canDelete) setDeleteTarget(category)
                      }}
                      onMoveUp={() => {
                        if (canUpdate) void runMove('move-up', category)
                      }}
                      onMoveDown={() => {
                        if (canUpdate) void runMove('move-down', category)
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

      {editingCategoryId !== null && (
        <BookingServiceCategoryEditModal
          categoryId={editingCategoryId}
          onClose={() => setEditingCategoryId(null)}
          onSuccess={(category) => {
            setEditingCategoryId(null)
            handleCategoryUpdated(category)
          }}
        />
      )}

      {deleteTarget && (
        <BookingServiceCategoryDeleteModal
          category={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(categoryId) => {
            setDeleteTarget(null)
            handleCategoryDeleted(categoryId)
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
