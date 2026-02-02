'use client'

import { useEffect, useMemo, useState } from 'react'

import RoleFiltersWrapper from './RoleFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import RoleRow, { RoleRowData } from './RoleRow'
import {
  RoleFilterValues,
  emptyRoleFilters,
} from './RoleFilters'
import RoleCreateModal from './RoleCreateModal'
import RoleEditModal from './RoleEditModal'
import RoleDeleteModal from './RoleDeleteModal'
import RolePermissionPanel from './RolePermissionPanel'
import {
  type RoleApiItem,
  mapRoleApiItemToRow,
} from './roleUtils'
import { useI18n } from '@/lib/i18n'
import type { PermissionOption } from './RoleCreateModal'

interface RoleTableProps {
  permissions: string[]
  isSuperAdmin?: boolean
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type RoleApiResponse = {
  data?: RoleApiItem[] | {
    current_page?: number
    data?: RoleApiItem[]
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

type PermissionApiResponse = {
  data?: Array<{
    id?: number | string | null
    name?: string | null
    slug?: string | null
    group_id?: number | string | null
    description?: string | null
  }>
  success?: boolean
  message?: string
}

export default function RoleTable({
  permissions,
  isSuperAdmin = false,
}: RoleTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<RoleFilterValues>({ ...emptyRoleFilters })
  const [filters, setFilters] = useState<RoleFilterValues>({ ...emptyRoleFilters })
  const [rows, setRows] = useState<RoleRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof RoleRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleRowData | null>(null)
  const [viewingPermissions, setViewingPermissions] = useState<RoleRowData | null>(null)
  const [permissionOptions, setPermissionOptions] = useState<PermissionOption[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)

  const canCreate = permissions.includes('roles.create')
  const canUpdate = permissions.includes('roles.update')
  const canDelete = permissions.includes('roles.delete')
  const canView = permissions.includes('roles.view')
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

  const fetchPermissions = async (controller: AbortController) => {
    setPermissionsLoading(true)
    try {
      const res = await fetch('/api/proxy/permissions/delegatable', {
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!res.ok) {
        return
      }

      const response: PermissionApiResponse = await res.json().catch(() => ({} as PermissionApiResponse))
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      const allPermissions: PermissionOption[] = Array.isArray(response?.data)
        ? response.data.map((perm) => ({
            id: perm?.slug ?? perm?.id ?? '',
            name: perm?.name ?? '',
            slug: perm?.slug ?? '',
          }))
        : []

      setPermissionOptions(allPermissions)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Failed to fetch permissions:', error)
      }
    } finally {
      if (!controller.signal.aborted) {
        setPermissionsLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const fetchRoles = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.name) qs.set('name', filters.name)
        if (filters.isActive) {
          qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
        }

        const endpoint = isSuperAdmin ? '/api/proxy/roles/all' : '/api/proxy/roles'
        const res = await fetch(`${endpoint}?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: RoleApiResponse = await res
          .json()
          .catch(() => ({} as RoleApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let roleItems: RoleApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            roleItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: RoleApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            roleItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: RoleRowData[] = roleItems.map((item) => mapRoleApiItemToRow(item))

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

    fetchRoles()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, isSuperAdmin])

  useEffect(() => {
    if (isCreateModalOpen || editingRoleId !== null) {
      const controller = new AbortController()
      fetchPermissions(controller).catch(() => {})
      return () => controller.abort()
    }
  }, [isCreateModalOpen, editingRoleId])

  const handleSort = (column: keyof RoleRowData) => {
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
    const nameFilter = filters.name.trim().toLowerCase()
    const statusFilter = filters.isActive

    return rows.filter((role) => {
      if (nameFilter && !role.name.toLowerCase().includes(nameFilter)) {
        return false
      }

      if (statusFilter) {
        const isActiveMatch =
          statusFilter === 'active' ? role.isActive : !role.isActive
        if (!isActiveMatch) {
          return false
        }
      }

      return true
    })
  }, [filters.isActive, filters.name, rows])

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredRows

    const compare = (a: RoleRowData, b: RoleRowData) => {
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

  const handleFilterChange = (values: RoleFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: RoleFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyRoleFilters })
    setFilters({ ...emptyRoleFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof RoleFilterValues) => {
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

  const colCount = showActions ? 5 : 4

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof RoleFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof RoleFilterValues, string> = {
    name: t('common.name'),
    isActive: t('common.status'),
  }

  const renderFilterValue = (key: keyof RoleFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const handleRoleCreated = (role: RoleRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== role.id)
      const next = [role, ...filtered]
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

  const handleRoleUpdated = (role: RoleRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === role.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = role
      return next
    })
  }

  const handleRoleDeleted = (roleId: number | string) => {
    setRows((prev) => prev.filter((item) => item.id !== roleId))

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
        <RoleFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <RoleCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(role) => {
            setIsCreateModalOpen(false)
            handleRoleCreated(role)
          }}
          permissions={permissionOptions}
          permissionsLoading={permissionsLoading}
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
              {t('role.createAction')}
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
                  { key: 'name', label: t('common.name') },
                  { key: 'description', label: 'Description' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'permissionNames', label: t('common.permissions') },
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
              sortedRows.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingRoleId(role.id as number)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(role)
                    }
                  }}
                  onViewPermissions={() => {
                    if (canView) {
                      setViewingPermissions(role)
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

      {editingRoleId !== null && (
        <RoleEditModal
          roleId={editingRoleId}
          onClose={() => setEditingRoleId(null)}
          onSuccess={(role) => {
            setEditingRoleId(null)
            handleRoleUpdated(role)
          }}
          permissions={permissionOptions}
          permissionsLoading={permissionsLoading}
        />
      )}

      {deleteTarget && (
        <RoleDeleteModal
          role={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(roleId) => {
            setDeleteTarget(null)
            handleRoleDeleted(roleId)
          }}
        />
      )}

      {viewingPermissions && (
        <RolePermissionPanel
          role={viewingPermissions}
          onClose={() => setViewingPermissions(null)}
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
