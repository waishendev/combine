'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import ProductRow, { type ProductRowData } from './ProductRow'
import { ProductFilterValues, emptyProductFilters } from './ProductFilters'
import ProductFiltersWrapper from './ProductFiltersWrapper'
import { mapProductApiItemToRow, type ProductApiItem } from './productUtils'
import BulkUpdateModal from './BulkUpdateModal'
import { useI18n } from '@/lib/i18n'

interface ProductTableProps {
  permissions: string[]
  basePath?: string
  rewardOnly?: boolean
  showCategories?: boolean
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ProductApiResponse = {
  data?: ProductApiItem[] | {
    current_page?: number
    data?: ProductApiItem[]
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


type StockAdjustmentState = {
  product: ProductRowData
  adjustmentType: 'stock_in' | 'stock_out'
  quantity: string
  costPricePerUnit: string
  remark: string
}

type ImportSummary = {
  totalRows: number
  created: number
  skipped: number
  failed: number
  failedRows?: Array<{ row: number; reason: string }>
}

export default function ProductTable({
  permissions,
  basePath = '/product',
  rewardOnly = false,
  showCategories = true,
}: ProductTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<ProductFilterValues>({ ...emptyProductFilters })
  const [filters, setFilters] = useState<ProductFilterValues>({ ...emptyProductFilters })
  const [rows, setRows] = useState<ProductRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof ProductRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<Array<{ row: number; reason: string }>>([])
  const [stockAdjustment, setStockAdjustment] = useState<StockAdjustmentState | null>(null)
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const router = useRouter()
  const canCreate = permissions.includes('ecommerce.products.create')
  const canUpdate = permissions.includes('ecommerce.products.update')
  const canDelete = permissions.includes('ecommerce.products.delete')
  const showActions = canUpdate || canDelete

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.search) qs.set('name', filters.search)
      if (filters.sku) qs.set('sku', filters.sku)
      if (filters.status) {
        qs.set('is_active', filters.status === 'active' ? 'true' : 'false')
      }
      if (rewardOnly) {
        qs.set('is_reward_only', 'true')
      } else {
        qs.set('is_reward_only', 'false')
      }

      const res = await fetch(`/api/proxy/ecommerce/products?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: ProductApiResponse = await res.json().catch(() => ({} as ProductApiResponse))
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let productItems: ProductApiItem[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          productItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: ProductApiItem[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          productItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      const list = productItems.map((item) => mapProductApiItemToRow(item))

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
      setLoading(false)
    }
  }, [currentPage, filters, pageSize, rewardOnly])

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/products/export?is_reward_only=${rewardOnly ? 'true' : 'false'}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error('Export CSV failed.')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/) ?? null
      const fileName = fileNameMatch?.[1] ?? `products_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
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

      const res = await fetch('/api/proxy/ecommerce/products/import', {
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
      await fetchProducts()
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

  useEffect(() => {
    const controller = new AbortController()
    fetchProducts(controller.signal)
    return () => controller.abort()
  }, [fetchProducts])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<number>()
      rows.forEach((row) => {
        if (prev.has(row.id)) {
          next.add(row.id)
        }
      })
      return next
    })
  }, [rows])

  const handleSort = (column: keyof ProductRowData) => {
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

    const compare = (a: ProductRowData, b: ProductRowData) => {
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

  const handleFilterChange = (values: ProductFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: ProductFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyProductFilters })
    setFilters({ ...emptyProductFilters })
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

  const columns = [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    ...(showCategories ? [{ key: 'categories', label: 'Categories' } as const] : []),
    { key: 'price', label: 'Price' },
    { key: 'stock', label: 'Stock' },
    { key: 'isActive', label: t('common.status') },
  ] as const
  const showSelection = canUpdate
  const colCount = columns.length + (showActions ? 1 : 0) + (showSelection ? 1 : 0)

  const visibleRowIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows])
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id))
  const hasSelection = selectedIds.size > 0

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        visibleRowIds.forEach((id) => next.add(id))
      } else {
        visibleRowIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const handleToggleSelect = (product: ProductRowData, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(product.id)
      } else {
        next.delete(product.id)
      }
      return next
    })
  }

  const selectedProducts = useMemo(() => {
    const selectedMap = new Set(selectedIds)
    return rows
      .filter((row) => selectedMap.has(row.id))
      .map((row) => {
        const mainImage = row.images.find((image) => image.isMain) ?? row.images[0]
        return {
          id: row.id,
          name: row.name,
          stock: row.stock,
          thumbnail_url: mainImage?.url,
        }
      })
  }, [rows, selectedIds])

  const totalPages = meta.last_page || 1

  const handleDelete = async (product: ProductRowData) => {
    const confirmed = window.confirm(`Delete ${product.name}?`)
    if (!confirmed) return

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${product.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        return
      }

      setRows((prev) => prev.filter((item) => item.id !== product.id))
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
    } catch (error) {
      console.error(error)
    }
  }


  const handleSubmitStockAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!stockAdjustment) return

    const quantity = Number.parseInt(stockAdjustment.quantity, 10)
    const costPrice = Number.parseFloat(stockAdjustment.costPricePerUnit || '0')

    if (!Number.isFinite(quantity) || quantity <= 0) {
      window.alert('Quantity must be greater than 0.')
      return
    }

    if (stockAdjustment.adjustmentType === 'stock_out' && quantity > stockAdjustment.product.stock) {
      window.alert('Reduce stock cannot make inventory negative.')
      return
    }

    if (stockAdjustment.adjustmentType === 'stock_in' && (!Number.isFinite(costPrice) || costPrice < 0)) {
      window.alert('Cost price per unit must be 0 or greater.')
      return
    }

    setIsSubmittingAdjustment(true)
    try {
      const payload: Record<string, unknown> = {
        adjustment_type: stockAdjustment.adjustmentType,
        quantity,
        remark: stockAdjustment.remark.trim() || null,
      }

      if (stockAdjustment.adjustmentType === 'stock_in') {
        payload.cost_price_per_unit = costPrice
      }

      const res = await fetch(`/api/proxy/ecommerce/products/${stockAdjustment.product.id}/stock-adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Failed to adjust stock.'
        throw new Error(message)
      }

      setStockAdjustment(null)
      await fetchProducts()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Failed to adjust stock.')
    } finally {
      setIsSubmittingAdjustment(false)
    }
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

  return (
    <div>
      {isBulkUpdateOpen && (
        <BulkUpdateModal
          show={isBulkUpdateOpen}
          onClose={() => setIsBulkUpdateOpen(false)}
          selectedProducts={selectedProducts}
          fetchProducts={() => fetchProducts()}
        />
      )}
      {isFilterModalOpen && (
        <ProductFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}
      {stockAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Stock Adjustment</h2>
              <button
                type="button"
                onClick={() => setStockAdjustment(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">{stockAdjustment.product.name} (Current stock: {stockAdjustment.product.stock})</p>
            <form className="space-y-4" onSubmit={handleSubmitStockAdjustment}>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Adjustment Type</label>
                <select
                  value={stockAdjustment.adjustmentType}
                  onChange={(event) =>
                    setStockAdjustment((prev) =>
                      prev
                        ? {
                            ...prev,
                            adjustmentType: event.target.value as 'stock_in' | 'stock_out',
                          }
                        : prev,
                    )
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="stock_in">Add Stock</option>
                  <option value="stock_out">Reduce Stock</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={stockAdjustment.quantity}
                  onChange={(event) =>
                    setStockAdjustment((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {stockAdjustment.adjustmentType === 'stock_in' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cost Price Per Unit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockAdjustment.costPricePerUnit}
                    onChange={(event) =>
                      setStockAdjustment((prev) => (prev ? { ...prev, costPricePerUnit: event.target.value } : prev))
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Remark (optional)</label>
                <textarea
                  value={stockAdjustment.remark}
                  onChange={(event) =>
                    setStockAdjustment((prev) => (prev ? { ...prev, remark: event.target.value } : prev))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Reason for this adjustment"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustment(null)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjustment}
                  className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmittingAdjustment ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Link
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              href={`${basePath}/create`}
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </Link>
          )}

          <Link
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            href="/products/stock-movements"
          >
            <i className="fa-solid fa-clock-rotate-left" />
            View Stock Logs
          </Link>

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>

          {showSelection && (
            <button
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={() => setIsBulkUpdateOpen(true)}
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
              if (file) {
                void handleImportCsvFile(file)
              }
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

      {(isImporting || importSummary) && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            Import status: processing file on server...
          </div>
          {importSummary && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>Total rows: {importSummary.totalRows}</div>
              <div>Created: {importSummary.created}</div>
              <div>Skipped: {importSummary.skipped}</div>
              <div>Failed: {importSummary.failed}</div>
            </div>
          )}
          {importFailedRows.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto text-xs text-red-600">
              {importFailedRows.slice(0, 20).map((item) => (
                <div key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</div>
              ))}
              {importFailedRows.length > 20 && <div>...and {importFailedRows.length - 20} more</div>}
            </div>
          )}
        </div>
      )}

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
                    onChange={(event) => handleToggleSelectAll(event.target.checked)}
                    aria-label="Select all products on this page"
                  />
                </th>
              )}
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key as keyof ProductRowData)}
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
                sortedRows.map((product) => (
                  <ProductRow
                  key={product.id}
                  product={product}
                  hideCategories={!showCategories}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  showSelection={showSelection}
                  isSelected={selectedIds.has(product.id)}
                  onToggleSelect={handleToggleSelect}
                  onEdit={() => {
                    if (canUpdate) {
                      router.push(`${basePath}/${product.id}/edit`)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      handleDelete(product)
                    }
                  }}
                  onStockAdjustment={() =>
                    setStockAdjustment({
                      product,
                      adjustmentType: 'stock_in',
                      quantity: '',
                      costPricePerUnit: '',
                      remark: '',
                    })
                  }
                  onViewStockLogs={() => router.push(`/products/stock-movements?product_id=${product.id}`)}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

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
