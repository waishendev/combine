'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import ShopMenuRow, { ShopMenuRowData } from './ShopMenuRow'
import ShopMenuCreateModal from './ShopMenuCreateModal'
import ShopMenuEditModal from './ShopMenuEditModal'
import ShopMenuDeleteModal from './ShopMenuDeleteModal'
import {
  type ShopMenuApiItem,
  mapShopMenuApiItemToRow,
} from './shopMenuUtils'
import { useI18n } from '@/lib/i18n'

interface ShopMenuTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ShopMenuApiResponse = {
  data?: ShopMenuApiItem[] | {
    current_page?: number
    data?: ShopMenuApiItem[]
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

export default function ShopMenuTable({
  permissions,
}: ShopMenuTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<ShopMenuRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof ShopMenuRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingShopMenuId, setEditingShopMenuId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShopMenuRowData | null>(null)
  const [movingShopMenuId, setMovingShopMenuId] = useState<number | null>(null)

  const canCreate = permissions.includes('ecommerce.shop-menu.create')
  const canUpdate = permissions.includes('ecommerce.shop-menu.update')
  const canDelete = permissions.includes('ecommerce.shop-menu.delete')
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
    const fetchShopMenus = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/ecommerce/shop-menu-items?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: ShopMenuApiResponse = await res
          .json()
          .catch(() => ({} as ShopMenuApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let shopMenuItems: ShopMenuApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            shopMenuItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: ShopMenuApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            shopMenuItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: ShopMenuRowData[] = shopMenuItems.map((item) => mapShopMenuApiItemToRow(item))

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

    fetchShopMenus()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleSort = (column: keyof ShopMenuRowData) => {
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

    const compare = (a: ShopMenuRowData, b: ShopMenuRowData) => {
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

  const handleShopMenuCreated = (shopMenu: ShopMenuRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== shopMenu.id)
      const next = [shopMenu, ...filtered]
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

  const handleShopMenuUpdated = (shopMenu: ShopMenuRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === shopMenu.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = shopMenu
      return next
    })
  }

  const handleShopMenuDeleted = (shopMenuId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== shopMenuId))

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

  const handleMoveUp = async (shopMenu: ShopMenuRowData) => {
    if (movingShopMenuId === shopMenu.id) return
    setMovingShopMenuId(shopMenu.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/shop-menu-items/${shopMenu.id}/move-up`,
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
        console.error('Failed to move shop menu up')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/shop-menu-items?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: ShopMenuApiResponse = await refreshRes
          .json()
          .catch(() => ({} as ShopMenuApiResponse))

        let shopMenuItems: ShopMenuApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            shopMenuItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: ShopMenuApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            shopMenuItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: ShopMenuRowData[] = shopMenuItems.map((item) =>
          mapShopMenuApiItemToRow(item),
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
      setMovingShopMenuId(null)
    }
  }

  const handleMoveDown = async (shopMenu: ShopMenuRowData) => {
    if (movingShopMenuId === shopMenu.id) return
    setMovingShopMenuId(shopMenu.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/shop-menu-items/${shopMenu.id}/move-down`,
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
        console.error('Failed to move shop menu down')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/shop-menu-items?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: ShopMenuApiResponse = await refreshRes
          .json()
          .catch(() => ({} as ShopMenuApiResponse))

        let shopMenuItems: ShopMenuApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            shopMenuItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: ShopMenuApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            shopMenuItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: ShopMenuRowData[] = shopMenuItems.map((item) =>
          mapShopMenuApiItemToRow(item),
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
      setMovingShopMenuId(null)
    }
  }

  return (
    <div>
      {isCreateModalOpen && (
        <ShopMenuCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(shopMenu) => {
            setIsCreateModalOpen(false)
            handleShopMenuCreated(shopMenu)
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
                const minSortOrder =
                  sortOrders.length > 0 ? Math.min(...sortOrders) : null
                const maxSortOrder =
                  sortOrders.length > 0 ? Math.max(...sortOrders) : null

                return sortedRows.map((shopMenu) => {
                  const isFirst =
                    shopMenu.sortOrder !== null &&
                    shopMenu.sortOrder === minSortOrder
                  const isLast =
                    shopMenu.sortOrder !== null &&
                    shopMenu.sortOrder === maxSortOrder

                  return (
                    <ShopMenuRow
                      key={shopMenu.id}
                      shopMenu={shopMenu}
                      showActions={showActions}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      isFirst={isFirst}
                      isLast={isLast}
                      onEdit={() => {
                        if (canUpdate) {
                          setEditingShopMenuId(shopMenu.id)
                        }
                      }}
                      onDelete={() => {
                        if (canDelete) {
                          setDeleteTarget(shopMenu)
                        }
                      }}
                      onMoveUp={() => {
                        if (canUpdate) {
                          handleMoveUp(shopMenu)
                        }
                      }}
                      onMoveDown={() => {
                        if (canUpdate) {
                          handleMoveDown(shopMenu)
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

      {editingShopMenuId !== null && (
        <ShopMenuEditModal
          shopMenuId={editingShopMenuId}
          onClose={() => setEditingShopMenuId(null)}
          onSuccess={(shopMenu) => {
            setEditingShopMenuId(null)
            handleShopMenuUpdated(shopMenu)
          }}
        />
      )}

      {deleteTarget && (
        <ShopMenuDeleteModal
          shopMenu={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(shopMenuId) => {
            setDeleteTarget(null)
            handleShopMenuDeleted(shopMenuId)
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
