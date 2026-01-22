'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import BankAccountRow, { BankAccountRowData } from './BankAccountRow'
import BankAccountCreateModal from './BankAccountCreateModal'
import BankAccountEditModal from './BankAccountEditModal'
import BankAccountDeleteModal from './BankAccountDeleteModal'
import {
  type BankAccountApiItem,
  mapBankAccountApiItemToRow,
} from './bankAccountUtils'
import { useI18n } from '@/lib/i18n'

interface BankAccountTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BankAccountApiResponse = {
  data?: BankAccountApiItem[] | {
    current_page?: number
    data?: BankAccountApiItem[]
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

export default function BankAccountTable({
  permissions,
}: BankAccountTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<BankAccountRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof BankAccountRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingBankAccountId, setEditingBankAccountId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankAccountRowData | null>(null)
  const [movingBankAccountId, setMovingBankAccountId] = useState<number | null>(null)

  const canCreate = permissions.includes('ecommerce.bank-accounts.create')
  const canUpdate = permissions.includes('ecommerce.bank-accounts.update')
  const canDelete = permissions.includes('ecommerce.bank-accounts.delete')
  const canMove = permissions.includes('ecommerce.bank-accounts.update')
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
    const fetchBankAccounts = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/ecommerce/bank-accounts?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: BankAccountApiResponse = await res
          .json()
          .catch(() => ({} as BankAccountApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let bankAccountItems: BankAccountApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            bankAccountItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: BankAccountApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            bankAccountItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: BankAccountRowData[] = bankAccountItems.map((item) => mapBankAccountApiItemToRow(item))

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

    fetchBankAccounts()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleSort = (column: keyof BankAccountRowData) => {
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

    const compare = (a: BankAccountRowData, b: BankAccountRowData) => {
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

  const handleBankAccountCreated = (bankAccount: BankAccountRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== bankAccount.id)
      const next = [bankAccount, ...filtered]
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

  const handleBankAccountUpdated = (bankAccount: BankAccountRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === bankAccount.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = bankAccount
      return next
    })
  }

  const handleBankAccountDeleted = (bankAccountId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== bankAccountId))

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

  const handleMoveUp = async (bankAccount: BankAccountRowData) => {
    if (movingBankAccountId === bankAccount.id) return
    setMovingBankAccountId(bankAccount.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/bank-accounts/${bankAccount.id}/move-up`,
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
        console.error('Failed to move bank account up')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/bank-accounts?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: BankAccountApiResponse = await refreshRes
          .json()
          .catch(() => ({} as BankAccountApiResponse))

        let bankAccountItems: BankAccountApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            bankAccountItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: BankAccountApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            bankAccountItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: BankAccountRowData[] = bankAccountItems.map((item) =>
          mapBankAccountApiItemToRow(item),
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
      setMovingBankAccountId(null)
    }
  }

  const handleMoveDown = async (bankAccount: BankAccountRowData) => {
    if (movingBankAccountId === bankAccount.id) return
    setMovingBankAccountId(bankAccount.id)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/bank-accounts/${bankAccount.id}/move-down`,
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
        console.error('Failed to move bank account down')
        return
      }

      // Refresh the list after successful move
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const refreshRes = await fetch(
        `/api/proxy/ecommerce/bank-accounts?${qs.toString()}`,
        {
          cache: 'no-store',
        },
      )

      if (refreshRes.ok) {
        const refreshResponse: BankAccountApiResponse = await refreshRes
          .json()
          .catch(() => ({} as BankAccountApiResponse))

        let bankAccountItems: BankAccountApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (refreshResponse?.data) {
          if (Array.isArray(refreshResponse.data)) {
            bankAccountItems = refreshResponse.data
          } else if (
            typeof refreshResponse.data === 'object' &&
            'data' in refreshResponse.data
          ) {
            const nestedData = refreshResponse.data as {
              data?: BankAccountApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            bankAccountItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: BankAccountRowData[] = bankAccountItems.map((item) =>
          mapBankAccountApiItemToRow(item),
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
      setMovingBankAccountId(null)
    }
  }

  return (
    <div>
      {isCreateModalOpen && (
        <BankAccountCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(bankAccount) => {
            setIsCreateModalOpen(false)
            handleBankAccountCreated(bankAccount)
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
              Create Bank Account
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
                  { key: 'label', label: 'Label' },
                  { key: 'bank_name', label: 'Bank Name' },
                  { key: 'account_name', label: 'Account Name' },
                  { key: 'account_number', label: 'Account Number' },
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
                // For move buttons, check based on sort_order
                const sortedByOrder = [...rows].sort((a, b) => {
                  const orderA = a.sort_order ?? 0
                  const orderB = b.sort_order ?? 0
                  return orderA - orderB
                })
                const minSortOrder = sortedByOrder[0]?.sort_order ?? null
                const maxSortOrder = sortedByOrder[sortedByOrder.length - 1]?.sort_order ?? null
                
                return sortedRows.map((bankAccount) => (
                  <BankAccountRow
                    key={bankAccount.id}
                    bankAccount={bankAccount}
                    showActions={showActions}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    canMove={canMove}
                    isFirst={bankAccount.sort_order === minSortOrder}
                    isLast={bankAccount.sort_order === maxSortOrder}
                    onEdit={() => {
                      if (canUpdate) {
                        setEditingBankAccountId(bankAccount.id)
                      }
                    }}
                    onDelete={() => {
                      if (canDelete) {
                        setDeleteTarget(bankAccount)
                      }
                    }}
                    onMoveUp={() => {
                      if (canMove) {
                        handleMoveUp(bankAccount)
                      }
                    }}
                    onMoveDown={() => {
                      if (canMove) {
                        handleMoveDown(bankAccount)
                      }
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

      {editingBankAccountId !== null && (
        <BankAccountEditModal
          bankAccountId={editingBankAccountId}
          onClose={() => setEditingBankAccountId(null)}
          onSuccess={(bankAccount) => {
            setEditingBankAccountId(null)
            handleBankAccountUpdated(bankAccount)
          }}
        />
      )}

      {deleteTarget && (
        <BankAccountDeleteModal
          bankAccount={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(bankAccountId) => {
            setDeleteTarget(null)
            handleBankAccountDeleted(bankAccountId)
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

