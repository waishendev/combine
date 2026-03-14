'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import BlockFiltersWrapper from './BlockFiltersWrapper'
import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'
import BlockRow, { BlockRowData } from './BlockRow'
import {
  BlockFilterValues,
  emptyBlockFilters,
} from './BlockFilters'
import BlockCreateModal from './BlockCreateModal'
import BlockEditModal from './BlockEditModal'
import BlockDeleteModal from './BlockDeleteModal'
import {
  type BlockApiItem,
  mapBlockApiItemToRow,
  type StaffOption,
} from './blockUtils'
import { useI18n } from '@/lib/i18n'

interface BlocksTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BlockApiResponse = {
  data?: BlockApiItem[] | {
    current_page?: number
    data?: BlockApiItem[]
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

export default function BlocksTable({
  permissions,
}: BlocksTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<BlockFilterValues>({ ...emptyBlockFilters })
  const [filters, setFilters] = useState<BlockFilterValues>({ ...emptyBlockFilters })
  const [rows, setRows] = useState<BlockRowData[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof BlockRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BlockRowData | null>(null)

  const canCreate = permissions.includes('booking.blocks.create')
  const canUpdate = permissions.includes('booking.blocks.update')
  const canDelete = permissions.includes('booking.blocks.delete')
  const showActions = canUpdate || canDelete

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  const staffNameMap = useMemo(() => {
    const map = new Map<number, string>()
    staffs.forEach((staff) => map.set(staff.id, staff.name))
    return map
  }, [staffs])

  useEffect(() => {
    const controller = new AbortController()
    const fetchStaffs = async () => {
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => ({}))
        const data = payload?.data
        if (Array.isArray(data)) {
          setStaffs(data as StaffOption[])
        } else if (data?.data && Array.isArray(data.data)) {
          setStaffs(data.data as StaffOption[])
        }
      } catch {
        // Ignore
      }
    }
    fetchStaffs()
    return () => controller.abort()
  }, [])

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

  const fetchBlocks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.scope) qs.set('scope', filters.scope)
      if (filters.staff_id) qs.set('staff_id', filters.staff_id)
      if (filters.from) qs.set('from', new Date(filters.from).toISOString())
      if (filters.to) qs.set('to', new Date(filters.to).toISOString())

      const res = await fetch(`/api/proxy/admin/booking/blocks?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: BlockApiResponse = await res
        .json()
        .catch(() => ({} as BlockApiResponse))
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let blockItems: BlockApiItem[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          blockItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: BlockApiItem[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          blockItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      const list: BlockRowData[] = blockItems.map((item) => mapBlockApiItemToRow(item, staffNameMap))

      setRows(list)
      
      const totalItems = list.length
      const calculatedLastPage = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1
      
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? calculatedLastPage) || 1,
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
  }, [currentPage, filters, pageSize, staffNameMap])

  useEffect(() => {
    const controller = new AbortController()
    fetchBlocks(controller.signal)
    return () => controller.abort()
  }, [fetchBlocks])

  const handleSort = (column: keyof BlockRowData) => {
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

    const compare = (a: BlockRowData, b: BlockRowData) => {
      const valueA = a[sortColumn]
      const valueB = b[sortColumn]

      const normalize = (value: unknown) => {
        if (value == null) return ''
        if (typeof value === 'string') return value.toLowerCase()
        if (typeof value === 'number') return value
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

  const handleFilterChange = (values: BlockFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: BlockFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyBlockFilters })
    setFilters({ ...emptyBlockFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof BlockFilterValues) => {
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

  const colCount = showActions ? 6 : 5

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof BlockFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof BlockFilterValues, string> = {
    scope: 'Scope',
    staff_id: 'Staff',
    from: 'From',
    to: 'To',
  }

  const renderFilterValue = (key: keyof BlockFilterValues, value: string) => {
    if (key === 'staff_id') {
      const staff = staffs.find(s => String(s.id) === value)
      return staff ? staff.name : value
    }
    if (key === 'from' || key === 'to') {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      return date.toLocaleString()
    }
    return value
  }

  const handleBlockCreated = (block: BlockRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== block.id)
      const next = [block, ...filtered]
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

  const handleBlockUpdated = (block: BlockRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === block.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = block
      return next
    })
  }

  const handleBlockDeleted = (blockId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== blockId))

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
        <BlockFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
          staffs={staffs}
        />
      )}

      {isCreateModalOpen && (
        <BlockCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(block) => {
            setIsCreateModalOpen(false)
            handleBlockCreated(block)
          }}
          defaultScope={filters.scope === 'STORE' || filters.scope === 'STAFF' ? filters.scope : undefined}
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
                  { key: 'scope', label: 'Scope' },
                  { key: 'staff_name', label: 'Staff' },
                  { key: 'start_at', label: 'Start' },
                  { key: 'end_at', label: 'End' },
                  { key: 'reason', label: 'Reason' },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key as keyof BlockRowData)}
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
              sortedRows.map((block) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingBlockId(block.id)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(block)
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

      {editingBlockId !== null && (
        <BlockEditModal
          blockId={editingBlockId}
          onClose={() => setEditingBlockId(null)}
          onSuccess={(block) => {
            setEditingBlockId(null)
            handleBlockUpdated(block)
          }}
        />
      )}

      {deleteTarget && (
        <BlockDeleteModal
          block={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(blockId) => {
            setDeleteTarget(null)
            handleBlockDeleted(blockId)
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
