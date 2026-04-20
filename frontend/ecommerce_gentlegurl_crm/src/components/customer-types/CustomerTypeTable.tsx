'use client'

import { useEffect, useMemo, useState } from 'react'

import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import CustomerTypeCreateModal from './CustomerTypeCreateModal'
import CustomerTypeDeleteModal from './CustomerTypeDeleteModal'
import CustomerTypeEditModal from './CustomerTypeEditModal'
import CustomerTypeRow from './CustomerTypeRow'
import { mapCustomerTypeApiItemToRow, type CustomerTypeApiItem, type CustomerTypeRowData } from './customerTypeUtils'

interface CustomerTypeTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type CustomerTypeApiResponse = {
  data?: CustomerTypeApiItem[] | {
    current_page?: number
    data?: CustomerTypeApiItem[]
    last_page?: number
    per_page?: number
    total?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function CustomerTypeTable({ permissions }: CustomerTypeTableProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<CustomerTypeRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof CustomerTypeRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingCustomerTypeId, setEditingCustomerTypeId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerTypeRowData | null>(null)

  const canCreate = permissions.includes('customers.create')
  const canUpdate = permissions.includes('customers.update')
  const canDelete = permissions.includes('customers.delete')
  const showActions = canUpdate || canDelete

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/customer-types?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: CustomerTypeApiResponse = await res.json().catch(() => ({}))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let items: CustomerTypeApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            items = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nested = response.data as {
              data?: CustomerTypeApiItem[]
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

        const list = items.map((item) => mapCustomerTypeApiItemToRow(item))
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

    void load()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleSort = (column: keyof CustomerTypeRowData) => {
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

    const normalize = (value: unknown) => {
      if (value == null) return ''
      if (typeof value === 'string') return value.toLowerCase()
      if (typeof value === 'number') return value
      return String(value).toLowerCase()
    }

    const sorted = [...rows].sort((a, b) => {
      const valueA = normalize(a[sortColumn])
      const valueB = normalize(b[sortColumn])

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueA - valueB
      }

      return String(valueA).localeCompare(String(valueB))
    })

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

  const handleCreated = (row: CustomerTypeRowData) => {
    setIsCreateModalOpen(false)
    if (currentPage !== 1) {
      setCurrentPage(1)
      return
    }

    setRows((prev) => {
      const next = [row, ...prev.filter((item) => item.id !== row.id)]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })

    setMeta((prev) => {
      const total = (prev.total || 0) + 1
      const perPage = prev.per_page || pageSize || 1
      return {
        ...prev,
        total,
        last_page: Math.max(prev.last_page || 1, Math.ceil(total / perPage)),
      }
    })
  }

  const handleUpdated = (row: CustomerTypeRowData) => {
    setEditingCustomerTypeId(null)
    setRows((prev) => prev.map((item) => (item.id === row.id ? row : item)))
  }

  const handleDeleted = (customerTypeId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== customerTypeId))
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

  const tableColumns: Array<{ key: keyof CustomerTypeRowData; label: string }> = [
    { key: 'name', label: 'Type Name' },
    { key: 'createdAt', label: 'Created At' },
    { key: 'updatedAt', label: 'Updated At' },
  ]

  const colCount = showActions ? 4 : 3

  return (
    <>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-plus" />
              Create
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="customerTypePageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="customerTypePageSize"
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

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              {tableColumns.map(({ key, label }) => {
                const isActive = sortColumn === key
                return (
                  <th
                    key={key}
                    className="cursor-pointer select-none px-4 py-2 border border-gray-200 text-left text-sm font-semibold"
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <DualSortIcons active={isActive} dir={isActive ? sortDirection : null} />
                  </th>
                )
              })}
              {showActions && (
                <th className="px-4 py-2 border border-gray-200 text-left text-sm font-semibold">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : sortedRows.length === 0 ? (
              <TableEmptyState
                colSpan={colCount}
                message="No customer types found. Create your first customer type."
              />
            ) : (
              sortedRows.map((row) => (
                <CustomerTypeRow
                  key={row.id}
                  row={row}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={(target) => setEditingCustomerTypeId(target.id)}
                  onDelete={(target) => setDeleteTarget(target)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={meta.current_page || currentPage}
        totalPages={meta.last_page || 1}
        pageSize={meta.per_page || pageSize}
        onPageChange={handlePageChange}
      />

      {isCreateModalOpen && (
        <CustomerTypeCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreated}
        />
      )}

      {editingCustomerTypeId !== null && (
        <CustomerTypeEditModal
          customerTypeId={editingCustomerTypeId}
          onClose={() => setEditingCustomerTypeId(null)}
          onSuccess={handleUpdated}
        />
      )}

      {deleteTarget && (
        <CustomerTypeDeleteModal
          customerType={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(id) => {
            setDeleteTarget(null)
            handleDeleted(id)
          }}
        />
      )}
    </>
  )
}
