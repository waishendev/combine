'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import PaginationControls from '@/components/PaginationControls'
import BookingProductCategoryRow, {
  type BookingProductCategoryRowData,
} from './BookingProductCategoryRow'
import BookingProductCategoryCreateModal from './BookingProductCategoryCreateModal'
import BookingProductCategoryEditModal from './BookingProductCategoryEditModal'
import BookingProductCategoryDeleteModal from './BookingProductCategoryDeleteModal'
import {
  mapBookingProductCategoryApiItemToRow,
  type BookingProductCategoryApiItem,
} from './bookingProductCategoryUtils'
import { useI18n } from '@/lib/i18n'

interface BookingProductCategoriesTableProps {
  permissions: string[]
}

type ImportFailedRow = {
  row: number
  reason: string
}

type ImportSummary = {
  totalRows: number
  created: number
  updated?: number
  skipped: number
  failed: number
  failedRows?: ImportFailedRow[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type CategoriesApiResponse = {
  data?: BookingProductCategoryApiItem[] | {
    current_page?: number
    data?: BookingProductCategoryApiItem[]
    last_page?: number
    per_page?: number
    total?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function BookingProductCategoriesTable({ permissions }: BookingProductCategoriesTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<BookingProductCategoryRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof BookingProductCategoryRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingCategory, setEditingCategory] = useState<BookingProductCategoryRowData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BookingProductCategoryRowData | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<ImportFailedRow[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

        const res = await fetch(`/api/proxy/admin/booking/product-categories?${qs.toString()}`, {
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

        let items: BookingProductCategoryApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            items = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nested = response.data as {
              data?: BookingProductCategoryApiItem[]
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

        const list = items.map((item) => mapBookingProductCategoryApiItemToRow(item))
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

  const handleSort = (column: keyof BookingProductCategoryRowData) => {
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

    const compare = (a: BookingProductCategoryRowData, b: BookingProductCategoryRowData) => {
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

  const handleCategoryCreated = (category: BookingProductCategoryRowData) => {
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

  const handleCategoryUpdated = (category: BookingProductCategoryRowData) => {
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

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/product-categories/export', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Export CSV failed.')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/) ?? null
      const fileName =
        fileNameMatch?.[1] ??
        `booking-product-categories-export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      window.alert('Export CSV failed. Please retry.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportCsvFile = async (file: File) => {
    setIsImporting(true)
    setImportSummary(null)
    setImportFailedRows([])
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/proxy/admin/booking/product-categories/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Import CSV failed. Please retry.'
        throw new Error(message)
      }

      const summaryPayload =
        json && typeof json === 'object' && 'data' in json && json.data && typeof json.data === 'object'
          ? (json.data as ImportSummary)
          : null
      if (!summaryPayload) {
        throw new Error('Import summary is missing from API response.')
      }

      setImportSummary(summaryPayload)
      setImportFailedRows(Array.isArray(summaryPayload.failedRows) ? summaryPayload.failedRows : [])
      await refreshList()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Import CSV failed. Please retry.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div>
      {isCreateModalOpen && (
        <BookingProductCategoryCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(category) => {
            setIsCreateModalOpen(false)
            handleCategoryCreated(category)
          }}
        />
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const f = event.target.files?.[0]
              if (f) {
                void handleImportCsvFile(f)
              }
            }}
          />
          <button
            type="button"
            className="rounded bg-violet-500 px-4 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50"
            onClick={handleExportCsv}
            disabled={loading || isExporting || isImporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="rounded bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isExporting || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <label htmlFor="productCategoryPageSize" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="productCategoryPageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
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

      {(isImporting || importSummary) && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>Import status: processing file on server...</div>
          {importSummary && (
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
              <div>Total rows: {importSummary.totalRows}</div>
              <div>Created: {importSummary.created}</div>
              <div>Updated: {importSummary.updated ?? 0}</div>
              <div>Skipped: {importSummary.skipped}</div>
              <div>Failed: {importSummary.failed}</div>
            </div>
          )}
          {importFailedRows.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {importFailedRows.map((item, index) => (
                <div key={`${item.row}-${index}`}>
                  Row {item.row}: {item.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {(
                [
                  { key: 'name', label: 'Name' },
                  { key: 'isActive', label: t('common.status') },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-gray-600"
                >
                  <button type="button" className="flex items-center gap-1" onClick={() => handleSort(key)}>
                    <span>{label}</span>
                    <DualSortIcons
                      active={sortColumn === key && sortDirection !== null}
                      dir={sortColumn === key ? sortDirection : null}
                    />
                  </button>
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              sortedRows.map((category) => (
                <BookingProductCategoryRow
                  key={category.id}
                  category={category}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={() => {
                    if (canUpdate) setEditingCategory(category)
                  }}
                  onDelete={() => {
                    if (canDelete) setDeleteTarget(category)
                  }}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingCategory && (
        <BookingProductCategoryEditModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSuccess={(category) => {
            setEditingCategory(null)
            handleCategoryUpdated(category)
          }}
        />
      )}

      {deleteTarget && (
        <BookingProductCategoryDeleteModal
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
