'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import StaffFiltersWrapper from './StaffFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import StaffRow, { StaffRowData } from './StaffRow'
import {
  StaffFilterValues,
  emptyStaffFilters,
} from './StaffFilters'
import StaffCreateModal from './StaffCreateModal'
import StaffEditModal from './StaffEditModal'
import StaffDeleteModal from './StaffDeleteModal'
import {
  type StaffApiItem,
  mapStaffApiItemToRow,
} from './staffUtils'
import { useI18n } from '@/lib/i18n'

interface StaffTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type StaffApiResponse = {
  data?: StaffApiItem[] | {
    current_page?: number
    data?: StaffApiItem[]
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

export default function StaffTable({ permissions }: StaffTableProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<StaffFilterValues>({ ...emptyStaffFilters })
  const [filters, setFilters] = useState<StaffFilterValues>({ ...emptyStaffFilters })
  const [rows, setRows] = useState<StaffRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof StaffRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffRowData | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const canCreate = permissions.includes('staff.create')
  const canUpdate = permissions.includes('staff.update')
  const canDelete = permissions.includes('staff.delete')
  const canViewPosSummary = permissions.includes('reports.pos-summary.view')
  const showActions = canUpdate || canDelete || canViewPosSummary

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
    const fetchStaffs = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.search) qs.set('search', filters.search)
        if (filters.isActive) {
          qs.set('is_active', filters.isActive === 'active' ? '1' : '0')
        }

        const res = await fetch(`/api/proxy/staffs?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: StaffApiResponse = await res
          .json()
          .catch(() => ({} as StaffApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let staffItems: StaffApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            staffItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: StaffApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            staffItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: StaffRowData[] = staffItems.map((item) => mapStaffApiItemToRow(item))

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

    fetchStaffs()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, reloadToken])

  const handleSort = (column: keyof StaffRowData) => {
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

  const filteredRows = useMemo(() => {
    const searchFilter = filters.search.trim().toLowerCase()
    const statusFilter = filters.isActive

    return rows.filter((staff) => {
      if (searchFilter) {
        const matchesSearch =
          staff.name.toLowerCase().includes(searchFilter) ||
          staff.code.toLowerCase().includes(searchFilter) ||
          staff.email.toLowerCase().includes(searchFilter)
        if (!matchesSearch) {
          return false
        }
      }

      if (statusFilter) {
        const statusMatches =
          statusFilter === 'active' ? staff.isActive : !staff.isActive
        if (!statusMatches) {
          return false
        }
      }

      return true
    })
  }, [filters.search, filters.isActive, rows])

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredRows

    const compare = (a: StaffRowData, b: StaffRowData) => {
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

    const sorted = [...filteredRows].sort(compare)
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [filteredRows, sortColumn, sortDirection])

  const handleFilterChange = (values: StaffFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: StaffFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyStaffFilters })
    setFilters({ ...emptyStaffFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof StaffFilterValues) => {
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

  const colCount = showActions ? 7 : 6

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof StaffFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof StaffFilterValues, string> = {
    search: 'Search',
    isActive: t('common.status'),
  }

  const renderFilterValue = (key: keyof StaffFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const refetchStaffs = () => {
    setCurrentPage(1)
    setReloadToken((prev) => prev + 1)
  }

  const handleStaffUpdated = (staff: StaffRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === staff.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = staff
      return next
    })
  }

  const handleStaffDeleted = (staffId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== staffId))

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
        <StaffFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <StaffCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            refetchStaffs()
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
              <i className="fa-solid fa-user-plus" />
              Create Staff
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
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'commissionRate', label: 'Product Commission Rate (%)' },
                  { key: 'serviceCommissionRate', label: 'Service Commission Rate (%)' },
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
              sortedRows.map((staff) => (
                <StaffRow
                  key={staff.id}
                  staff={staff}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canViewPosSummary={canViewPosSummary}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingStaffId(staff.id)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(staff)
                    }
                  }}
                  onViewPosSummary={() => {
                    if (!canViewPosSummary || !staff.adminUserId) {
                      return
                    }

                    const qs = new URLSearchParams({
                      created_by_user_id: String(staff.adminUserId),
                      staff_name: staff.name,
                    })
                    router.push(`/reports/pos-summary?${qs.toString()}`)
                  }}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingStaffId !== null && (
        <StaffEditModal
          staffId={editingStaffId}
          onClose={() => setEditingStaffId(null)}
          onSuccess={(staff) => {
            setEditingStaffId(null)
            handleStaffUpdated(staff)
          }}
        />
      )}

      {deleteTarget && (
        <StaffDeleteModal
          staff={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(staffId) => {
            setDeleteTarget(null)
            handleStaffDeleted(staffId)
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
