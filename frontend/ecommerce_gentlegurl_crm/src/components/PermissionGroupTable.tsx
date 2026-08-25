'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import PermissionGroupRow, {
  PermissionGroupRowData,
} from './PermissionGroupRow'
import PermissionGroupCreateModal from './PermissionGroupCreateModal'
import PermissionGroupEditModal from './PermissionGroupEditModal'
import PermissionGroupDeleteModal from './PermissionGroupDeleteModal'
import CrmPageLoadingOverlay from './CrmPageLoadingOverlay'
import {
  type PermissionGroupApiItem,
  mapPermissionGroupApiItemToRow,
} from './permissionGroupUtils'
import { useI18n } from '@/lib/i18n'

interface PermissionGroupTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type PermissionGroupApiResponse = {
  data?:
    | PermissionGroupApiItem[]
    | {
        current_page?: number
        data?: PermissionGroupApiItem[]
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

export default function PermissionGroupTable({
  permissions,
}: PermissionGroupTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<PermissionGroupRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<
    keyof PermissionGroupRowData | null
  >(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null,
  )
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<PermissionGroupRowData | null>(null)
  const [movingGroupId, setMovingGroupId] = useState<number | null>(null)

  const canCreate = permissions.includes('permission-groups.create')
  const canUpdate = permissions.includes('permission-groups.update')
  const canDelete = permissions.includes('permission-groups.delete')
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
    const fetchGroups = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/permission-groups/query?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: PermissionGroupApiResponse = await res
          .json()
          .catch(() => ({} as PermissionGroupApiResponse))
        if (
          response?.success === false &&
          response?.message === 'Unauthorized'
        ) {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let groupItems: PermissionGroupApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            groupItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: PermissionGroupApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            groupItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: PermissionGroupRowData[] = groupItems.map((item) =>
          mapPermissionGroupApiItemToRow(item),
        )

        setRows(list)
        setMeta({
          current_page:
            Number(paginationData.current_page ?? currentPage) || 1,
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

    fetchGroups()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleSort = (column: keyof PermissionGroupRowData) => {
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

    const compare = (a: PermissionGroupRowData, b: PermissionGroupRowData) => {
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

  const colCount = showActions ? 3 : 2

  const totalPages = meta.last_page || 1

  const handleGroupCreated = (group: PermissionGroupRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== group.id)
      const next = [group, ...filtered]
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

  const handleGroupUpdated = (group: PermissionGroupRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === group.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = group
      return next
    })
  }

  const handleGroupDeleted = (groupId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== groupId))

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

  const applyLocalReorder = (
    movedId: number,
    swappedId: number,
    movedSortOrder: number | null,
    swappedSortOrder: number | null,
  ) => {
    setRows((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === movedId)
      const toIndex = prev.findIndex((item) => item.id === swappedId)
      if (fromIndex === -1 || toIndex === -1) return prev

      const next = [...prev]
      const fromRow = { ...next[fromIndex], sortOrder: movedSortOrder }
      const toRow = { ...next[toIndex], sortOrder: swappedSortOrder }
      next[fromIndex] = toRow
      next[toIndex] = fromRow
      return next
    })
  }

  const handleMoveUp = async (group: PermissionGroupRowData) => {
    if (movingGroupId === group.id) return
    setMovingGroupId(group.id)

    try {
      const res = await fetch(
        `/api/proxy/permission-groups/${group.id}/move-up/query`,
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
        console.error('Failed to move group up')
        return
      }

      const payload = (data as { data?: {
        moved?: { id?: number; sort_order?: number }
        swapped?: { id?: number; sort_order?: number }
      } })?.data

      const movedId = Number(payload?.moved?.id)
      const swappedId = Number(payload?.swapped?.id)
      if (!Number.isFinite(movedId) || !Number.isFinite(swappedId)) return

      applyLocalReorder(
        movedId,
        swappedId,
        Number.isFinite(Number(payload?.moved?.sort_order))
          ? Number(payload?.moved?.sort_order)
          : null,
        Number.isFinite(Number(payload?.swapped?.sort_order))
          ? Number(payload?.swapped?.sort_order)
          : null,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setMovingGroupId(null)
    }
  }

  const handleMoveDown = async (group: PermissionGroupRowData) => {
    if (movingGroupId === group.id) return
    setMovingGroupId(group.id)

    try {
      const res = await fetch(
        `/api/proxy/permission-groups/${group.id}/move-down/query`,
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
        console.error('Failed to move group down')
        return
      }

      const payload = (data as { data?: {
        moved?: { id?: number; sort_order?: number }
        swapped?: { id?: number; sort_order?: number }
      } })?.data

      const movedId = Number(payload?.moved?.id)
      const swappedId = Number(payload?.swapped?.id)
      if (!Number.isFinite(movedId) || !Number.isFinite(swappedId)) return

      applyLocalReorder(
        movedId,
        swappedId,
        Number.isFinite(Number(payload?.moved?.sort_order))
          ? Number(payload?.moved?.sort_order)
          : null,
        Number.isFinite(Number(payload?.swapped?.sort_order))
          ? Number(payload?.swapped?.sort_order)
          : null,
      )
    } catch (err) {
      console.error(err)
    } finally {
      setMovingGroupId(null)
    }
  }

  return (
    <div>
      {editLoadingId !== null && (
        <CrmPageLoadingOverlay message={t('common.loadingDetails')} />
      )}
      {isCreateModalOpen && (
        <PermissionGroupCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(group) => {
            setIsCreateModalOpen(false)
            handleGroupCreated(group)
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
              {t('permissionGroup.createAction')}
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
              {(
                [
                  { key: 'name', label: t('permissionGroup.name') },
                  { key: 'sortOrder', label: t('permissionGroup.sortOrder') },
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

                return sortedRows.map((group) => {
                  const isFirst =
                    group.sortOrder !== null &&
                    group.sortOrder === minSortOrder
                  const isLast =
                    group.sortOrder !== null &&
                    group.sortOrder === maxSortOrder

                  return (
                    <PermissionGroupRow
                      key={group.id}
                      group={group}
                      showActions={showActions}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      isFirst={isFirst}
                      isLast={isLast}
                      editLoading={editLoadingId === group.id}
                      onEdit={() => {
                        if (canUpdate) {
                          setEditLoadingId(group.id)
                          setEditingGroupId(group.id)
                        }
                      }}
                      onDelete={() => {
                        if (canDelete) {
                          setDeleteTarget(group)
                        }
                      }}
                      onMoveUp={() => {
                        if (canUpdate) {
                          handleMoveUp(group)
                        }
                      }}
                      onMoveDown={() => {
                        if (canUpdate) {
                          handleMoveDown(group)
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

      {editingGroupId !== null && (
        <PermissionGroupEditModal
          groupId={editingGroupId}
          onClose={() => {
            setEditingGroupId(null)
            setEditLoadingId(null)
          }}
          onReady={() => setEditLoadingId(null)}
          onSuccess={(group) => {
            setEditingGroupId(null)
            setEditLoadingId(null)
            handleGroupUpdated(group)
          }}
        />
      )}

      {deleteTarget && (
        <PermissionGroupDeleteModal
          group={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(groupId) => {
            setDeleteTarget(null)
            handleGroupDeleted(groupId)
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

