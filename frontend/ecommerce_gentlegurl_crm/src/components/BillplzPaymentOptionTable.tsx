'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import BillplzPaymentOptionRow, { BillplzPaymentOptionRowData } from './BillplzPaymentOptionRow'
import BillplzPaymentOptionCreateModal from './BillplzPaymentOptionCreateModal'
import BillplzPaymentOptionEditModal from './BillplzPaymentOptionEditModal'
import BillplzPaymentOptionDeleteModal from './BillplzPaymentOptionDeleteModal'
import {
  type BillplzPaymentOptionApiItem,
  type GatewayGroup,
  mapBillplzPaymentOptionApiItemToRow,
} from './billplzPaymentOptionUtils'
import { useI18n } from '@/lib/i18n'
import { getWorkspace } from '@/lib/workspace'

interface BillplzPaymentOptionTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BillplzOptionApiResponse = {
  data?: BillplzPaymentOptionApiItem[] | {
    current_page?: number
    data?: BillplzPaymentOptionApiItem[]
    last_page?: number
    per_page?: number
    total?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function BillplzPaymentOptionTable({
  permissions,
}: BillplzPaymentOptionTableProps) {
  const { t } = useI18n()
  const workspaceType = getWorkspace()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<BillplzPaymentOptionRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [groupFilter, setGroupFilter] = useState<GatewayGroup>('online_banking')
  const [sortColumn, setSortColumn] = useState<keyof BillplzPaymentOptionRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingOption, setEditingOption] = useState<BillplzPaymentOptionRowData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BillplzPaymentOptionRowData | null>(null)
  const [movingOptionId, setMovingOptionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const permissionPrefix = workspaceType === 'booking' ? 'booking' : 'ecommerce'
  const canCreate = permissions.includes(`${permissionPrefix}.billplz-payment-gateways.create`)
  const canUpdate = permissions.includes(`${permissionPrefix}.billplz-payment-gateways.update`)
  const canDelete = permissions.includes(`${permissionPrefix}.billplz-payment-gateways.delete`)
  const canMove = canUpdate
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

  const fetchOptions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      qs.set('type', workspaceType)
      qs.set('gateway_group', groupFilter)

      const res = await fetch(`/api/proxy/ecommerce/billplz-payment-gateway-options?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      const response: BillplzOptionApiResponse = await res.json().catch(() => ({} as BillplzOptionApiResponse))
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      if (!res.ok || response?.success === false) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        setError(response?.message || 'Failed to load Billplz payment options.')
        return
      }

      let items: BillplzPaymentOptionApiItem[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          items = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: BillplzPaymentOptionApiItem[]
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

      if (response?.meta) {
        paginationData = { ...paginationData, ...response.meta }
      }

      const list = items.map((item) => mapBillplzPaymentOptionApiItemToRow(item))
      setRows(list)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? list.length) || list.length,
      })
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        setError('Failed to load Billplz payment options.')
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [currentPage, groupFilter, pageSize, workspaceType])

  useEffect(() => {
    const controller = new AbortController()
    void fetchOptions(controller.signal)
    return () => controller.abort()
  }, [fetchOptions])

  const handleSort = (column: keyof BillplzPaymentOptionRowData) => {
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

    const compare = (a: BillplzPaymentOptionRowData, b: BillplzPaymentOptionRowData) => {
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

  const colCount = showActions ? 8 : 7
  const totalPages = meta.last_page || 1

  const handleOptionCreated = (option: BillplzPaymentOptionRowData) => {
    if (option.type !== workspaceType || option.gateway_group !== groupFilter) {
      return
    }

    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== option.id)
      const next = [option, ...filtered]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = (prevMeta.total || 0) + 1
      const last_page = Math.max(prevMeta.last_page || 1, Math.ceil(total / perPage))
      return { ...prevMeta, total, last_page }
    })
  }

  const handleOptionUpdated = (option: BillplzPaymentOptionRowData) => {
    if (option.type !== workspaceType || option.gateway_group !== groupFilter) {
      setRows((prev) => prev.filter((item) => item.id !== option.id))
      return
    }

    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === option.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = option
      return next
    })
  }

  const handleOptionDeleted = (optionId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== optionId))

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

  const swapAdjacent = (
    prev: BillplzPaymentOptionRowData[],
    rowId: number,
    direction: 'up' | 'down',
  ): BillplzPaymentOptionRowData[] | null => {
    const idx = prev.findIndex((r) => r.id === rowId)
    if (idx === -1) return null
    const next = [...prev]
    if (direction === 'up') {
      if (idx === 0) return null
      const j = idx - 1
      const a = next[idx]
      const b = next[j]
      next[j] = { ...a, sort_order: b.sort_order }
      next[idx] = { ...b, sort_order: a.sort_order }
      return next
    }
    if (idx >= next.length - 1) return null
    const j = idx + 1
    const a = next[idx]
    const b = next[j]
    next[idx] = { ...b, sort_order: a.sort_order }
    next[j] = { ...a, sort_order: b.sort_order }
    return next
  }

  const handleMove = async (option: BillplzPaymentOptionRowData, direction: 'up' | 'down') => {
    if (movingOptionId === option.id) return
    setMovingOptionId(option.id)
    setError(null)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/billplz-payment-gateway-options/${option.id}/move-${direction}?type=${option.type}`,
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
        setError(typeof data?.message === 'string' ? data.message : `Failed to move option ${direction}.`)
        return
      }

      setRows((prev) => swapAdjacent(prev, option.id, direction) ?? prev)
    } catch (err) {
      console.error(err)
      setError(`Failed to move option ${direction}.`)
    } finally {
      setMovingOptionId(null)
    }
  }

  return (
    <div>
      {isCreateModalOpen && (
        <BillplzPaymentOptionCreateModal
          defaultGroup={groupFilter}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(option) => {
            setIsCreateModalOpen(false)
            handleOptionCreated(option)
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
          <select
            className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            value={groupFilter}
            onChange={(event) => {
              setGroupFilter(event.target.value as GatewayGroup)
              setCurrentPage(1)
            }}
          >
            <option value="online_banking">Online Banking</option>
            <option value="credit_card">Credit Card</option>
          </select>
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

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                Image
              </th>
              {(
                [
                  { key: 'gateway_group', label: 'Group' },
                  { key: 'code', label: 'Code' },
                  { key: 'name', label: 'Name' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'isDefault', label: 'Default' },
                  { key: 'sort_order', label: 'Sort Order' },
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
                  .map((r) => r.sort_order)
                  .filter((so): so is number => so !== null)
                const minSortOrder = sortOrders.length > 0 ? Math.min(...sortOrders) : null
                const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : null

                return sortedRows.map((option) => (
                  <BillplzPaymentOptionRow
                    key={option.id}
                    option={option}
                    showActions={showActions}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    canMove={canMove}
                    isFirst={option.sort_order !== null && option.sort_order === minSortOrder}
                    isLast={option.sort_order !== null && option.sort_order === maxSortOrder}
                    onEdit={() => {
                      if (canUpdate) setEditingOption(option)
                    }}
                    onDelete={() => {
                      if (canDelete) setDeleteTarget(option)
                    }}
                    onMoveUp={() => {
                      if (canMove) void handleMove(option, 'up')
                    }}
                    onMoveDown={() => {
                      if (canMove) void handleMove(option, 'down')
                    }}
                  />
                ))
              })()
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingOption !== null && (
        <BillplzPaymentOptionEditModal
          optionId={editingOption.id}
          onClose={() => setEditingOption(null)}
          onSuccess={(option) => {
            setEditingOption(null)
            handleOptionUpdated(option)
          }}
        />
      )}

      {deleteTarget && (
        <BillplzPaymentOptionDeleteModal
          option={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(optionId) => {
            setDeleteTarget(null)
            handleOptionDeleted(optionId)
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
