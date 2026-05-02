'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'
import BookingProductFiltersWrapper, { emptyBookingProductFilters, type BookingProductFilterValues } from './BookingProductFiltersWrapper'
import BookingProductUpsertModal from './BookingProductUpsertModal'
import BookingProductDeleteModal from './BookingProductDeleteModal'
import BookingProductBulkUpdateModal from './BookingProductBulkUpdateModal'
import type { BookingProductCategory, BookingProductRowData } from './bookingProductTypes'

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BookingProductApiResponse = {
  data?: BookingProductRowData[] | {
    current_page?: number
    data?: BookingProductRowData[]
    last_page?: number
    per_page?: number
    total?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function BookingProductsTable({ permissions = [] as string[] }) {
  const canCreate = permissions.includes('booking.services.create')
  const canUpdate = permissions.includes('booking.services.update')
  const canDelete = permissions.includes('booking.services.delete')
  const showActions = canUpdate || canDelete
  const showSelection = canUpdate

  const [rows, setRows] = useState<BookingProductRowData[]>([])
  const [categories, setCategories] = useState<BookingProductCategory[]>([])
  const [inputs, setInputs] = useState<BookingProductFilterValues>({ ...emptyBookingProductFilters })
  const [filters, setFilters] = useState<BookingProductFilterValues>({ ...emptyBookingProductFilters })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [loading, setLoading] = useState(true)

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  const [upsertOpen, setUpsertOpen] = useState(false)
  const [upsertTarget, setUpsertTarget] = useState<BookingProductRowData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BookingProductRowData | null>(null)

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch('/api/proxy/admin/booking/product-categories?all=1', { cache: 'no-store', signal })
      const j = await r.json().catch(() => null)
      const payload = j?.data?.data ?? j?.data ?? j
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      setCategories(
        list
          .map((c: any) => ({ id: Number(c?.id), name: String(c?.name ?? ''), sort_order: Number(c?.sort_order ?? 0), is_active: Boolean(c?.is_active ?? true) }))
          .filter((c: BookingProductCategory) => Number.isFinite(c.id) && c.id > 0 && c.name.trim()),
      )
    } catch {
      setCategories([])
    }
  }, [])

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.search.trim()) qs.set('search', filters.search.trim())
      if (filters.status) qs.set('is_active', filters.status === 'active' ? 'true' : 'false')
      if (filters.category_id) qs.set('category_id', filters.category_id)

      const r = await fetch(`/api/proxy/admin/booking/products?${qs.toString()}`, { cache: 'no-store', signal })
      if (!r.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const resp: BookingProductApiResponse = await r.json().catch(() => ({} as BookingProductApiResponse))
      let items: BookingProductRowData[] = []
      let paginationData: Partial<Meta> = {}

      if (resp?.data) {
        if (Array.isArray(resp.data)) {
          items = resp.data
        } else if (typeof resp.data === 'object' && 'data' in resp.data) {
          const nested = resp.data as any
          items = Array.isArray(nested.data) ? nested.data : []
          paginationData = {
            current_page: nested.current_page,
            last_page: nested.last_page,
            per_page: nested.per_page,
            total: nested.total,
          }
        }
      }
      if (resp?.meta) paginationData = { ...paginationData, ...resp.meta }

      setRows(items)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? items.length) || items.length,
      })
    } catch (e) {
      setRows([])
      setMeta((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, filters])

  useEffect(() => {
    const controller = new AbortController()
    void fetchCategories(controller.signal)
    return () => controller.abort()
  }, [fetchCategories])

  useEffect(() => {
    const controller = new AbortController()
    void fetchProducts(controller.signal)
    return () => controller.abort()
  }, [fetchProducts])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<number>()
      rows.forEach((row) => {
        if (prev.has(row.id)) next.add(row.id)
      })
      return next
    })
  }, [rows])

  const visibleRowIds = useMemo(() => rows.map((r) => r.id), [rows])
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id))
  const hasSelection = selectedIds.size > 0

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) visibleRowIds.forEach((id) => next.add(id))
      else visibleRowIds.forEach((id) => next.delete(id))
      return next
    })
  }

  const handleToggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedProducts = useMemo(() => {
    const s = new Set(selectedIds)
    return rows.filter((r) => s.has(r.id))
  }, [rows, selectedIds])

  const colCount = 5 + (showActions ? 1 : 0) + (showSelection ? 1 : 0)

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/products/export', { cache: 'no-store' })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename=\"?([^\";]+)\"?/) ?? null
      const fileName = fileNameMatch?.[1] ?? `booking_products_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportCsvFile = async (file: File) => {
    setIsImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/proxy/admin/booking/products/import', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error((json && (json.message || (json.errors && Object.values(json.errors)[0]?.[0]))) || 'Import failed.')
      }
      await fetchProducts()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (product: BookingProductRowData) => {
    await fetch(`/api/proxy/admin/booking/products/${product.id}`, { method: 'DELETE' })
    await fetchProducts()
  }

  return (
    <div>
      {isFilterOpen && (
        <BookingProductFiltersWrapper
          show={isFilterOpen}
          inputs={inputs}
          categories={categories}
          disabled={loading}
          onChange={setInputs}
          onSubmit={(next) => {
            setFilters(next)
            setInputs(next)
            setCurrentPage(1)
            setIsFilterOpen(false)
          }}
          onReset={() => {
            setInputs({ ...emptyBookingProductFilters })
            setFilters({ ...emptyBookingProductFilters })
            setCurrentPage(1)
          }}
          onClose={() => setIsFilterOpen(false)}
        />
      )}

      {upsertOpen && (
        <BookingProductUpsertModal
          show={upsertOpen}
          categories={categories}
          product={upsertTarget}
          onClose={() => {
            setUpsertOpen(false)
            setUpsertTarget(null)
          }}
          onSuccess={async () => {
            await fetchProducts()
          }}
        />
      )}

      {deleteTarget && (
        <BookingProductDeleteModal
          show={Boolean(deleteTarget)}
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => {
            await handleDelete(deleteTarget)
          }}
        />
      )}

      {isBulkOpen && (
        <BookingProductBulkUpdateModal
          show={isBulkOpen}
          selectedProducts={selectedProducts}
          categories={categories}
          onClose={() => setIsBulkOpen(false)}
          onSuccess={async () => {
            await fetchProducts()
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setUpsertTarget(null)
                setUpsertOpen(true)
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-plus" />
              Create
            </button>
          )}

          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            Filter
          </button>

          {showSelection && (
            <button
              type="button"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={() => setIsBulkOpen(true)}
              disabled={!hasSelection}
            >
              <i className="fa-solid fa-pen-to-square" />
              Bulk Update
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImportCsvFile(file)
            }}
          />
          <button
            type="button"
            className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={handleExportCsv}
            disabled={loading || isExporting || isImporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isExporting || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>

          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
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
              {showSelection && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={allVisibleSelected}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Image</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Price</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Category</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">Status</th>
              {showActions && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              rows.map((p) => (
                <tr key={p.id} className="border-t text-sm">
                  {showSelection && (
                    <td className="px-4 py-2 border border-gray-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        checked={selectedIds.has(p.id)}
                        onChange={(e) => handleToggleSelect(p.id, e.target.checked)}
                        aria-label={`Select ${p.name}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2 border border-gray-200">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover border border-gray-200 bg-gray-50" />
                    ) : (
                      <div className="h-10 w-10 rounded border border-dashed border-gray-300 bg-gray-50" />
                    )}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">{p.name}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {Number(p.price ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2 border border-gray-200">{p.category?.name ?? '-'}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {showActions && (
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              setUpsertTarget(p)
                              setUpsertOpen(true)
                            }}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => setDeleteTarget(p)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={meta.last_page || 1}
        pageSize={pageSize}
        onPageChange={(p) => setCurrentPage(p)}
        disabled={loading}
      />
    </div>
  )
}
