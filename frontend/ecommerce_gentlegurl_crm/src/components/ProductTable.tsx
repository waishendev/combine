'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

type ImportSummary = {
  totalRows: number
  toCreate: number
  skipped: number
  failed: number
}

const IMPORT_ALLOWED_FIELDS = new Set([
  'name',
  'slug',
  'sku',
  'type',
  'description',
  'price',
  'sale_price',
  'sale_price_start_at',
  'sale_price_end_at',
  'cost_price',
  'stock',
  'low_stock_threshold',
  'track_stock',
  'dummy_sold_count',
  'is_active',
  'is_featured',
  'is_reward_only',
  'meta_title',
  'meta_description',
  'meta_keywords',
  'meta_og_image',
  'category_ids',
  'variants',
])

const IMPORT_NUMERIC_FIELDS = new Set([
  'price',
  'sale_price',
  'cost_price',
  'stock',
  'low_stock_threshold',
  'dummy_sold_count',
])

const IMPORT_BOOLEAN_FIELDS = new Set([
  'track_stock',
  'is_active',
  'is_featured',
  'is_reward_only',
])

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
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<Array<{ row: number; reason: string }>>([])
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

  const fetchAllProducts = useCallback(async () => {
    const perPage = 200
    let page = 1
    let lastPage = 1
    const allItems: ProductApiItem[] = []

    do {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('per_page', String(perPage))
      qs.set('is_reward_only', rewardOnly ? 'true' : 'false')
      const res = await fetch(`/api/proxy/ecommerce/products?${qs.toString()}`, { cache: 'no-store' })

      if (!res.ok) {
        throw new Error(`Failed to fetch products page ${page}`)
      }

      const response: ProductApiResponse = await res.json().catch(() => ({} as ProductApiResponse))
      let pageItems: ProductApiItem[] = []
      let metaPage = page
      let metaLastPage = lastPage

      if (Array.isArray(response.data)) {
        pageItems = response.data
      } else if (response.data && typeof response.data === 'object') {
        pageItems = Array.isArray(response.data.data) ? response.data.data : []
        metaPage = Number(response.data.current_page ?? page) || page
        metaLastPage = Number(response.data.last_page ?? lastPage) || lastPage
      }

      if (response.meta) {
        metaPage = Number(response.meta.current_page ?? metaPage) || metaPage
        metaLastPage = Number(response.meta.last_page ?? metaLastPage) || metaLastPage
      }

      allItems.push(...pageItems)
      page = metaPage + 1
      lastPage = Math.max(metaLastPage, 1)
    } while (page <= lastPage)

    return allItems
  }, [rewardOnly])

  const csvEscape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const parseCsv = (text: string) => {
    const rows: string[][] = []
    let row: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      const next = text[i + 1]

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current)
        current = ''
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1
        row.push(current)
        if (row.some((cell) => cell.length > 0)) {
          rows.push(row)
        }
        row = []
        current = ''
      } else {
        current += char
      }
    }

    row.push(current)
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row)
    }

    return rows
  }

  const parseImportValue = (header: string, value: string): unknown => {
    const normalized = value.trim()
    if (normalized === '') return ''

    if (IMPORT_BOOLEAN_FIELDS.has(header)) {
      return normalized === '1' || normalized.toLowerCase() === 'true'
    }

    if (IMPORT_NUMERIC_FIELDS.has(header)) {
      const numeric = Number(normalized)
      return Number.isFinite(numeric) ? numeric : normalized
    }

    if (normalized.startsWith('{') || normalized.startsWith('[')) {
      try {
        return JSON.parse(normalized)
      } catch {
        return normalized
      }
    }

    return normalized
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const products = await fetchAllProducts()
      const rowsForExport = products.map((item) => ({
        ...item,
        category_ids: Array.isArray(item.categories)
          ? item.categories
              .map((category) =>
                typeof category.id === 'number' ? category.id : Number(category.id ?? 0),
              )
              .filter((id) => Number.isFinite(id) && id > 0)
          : [],
      }))

      const headers = Array.from(
        rowsForExport.reduce((acc, item) => {
          Object.keys(item).forEach((key) => acc.add(key))
          return acc
        }, new Set<string>()),
      )

      const csvLines = [headers.map((header) => csvEscape(header)).join(',')]
      rowsForExport.forEach((item) => {
        const line = headers.map((header) => csvEscape((item as Record<string, unknown>)[header])).join(',')
        csvLines.push(line)
      })

      const csvText = `\uFEFF${csvLines.join('\r\n')}`
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
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
    setImportProgress({ processed: 0, total: 0 })

    try {
      const text = await file.text()
      const csvRows = parseCsv(text.replace(/^\uFEFF/, ''))
      if (csvRows.length < 2) {
        throw new Error('CSV has no data rows.')
      }

      const headers = csvRows[0].map((header) => header.trim())
      const dataRows = csvRows.slice(1)
      const existingProducts = await fetchAllProducts()
      const existingSkuSet = new Set(
        existingProducts
          .map((item) => String(item.sku ?? '').trim().toLowerCase())
          .filter(Boolean),
      )
      const existingSlugSet = new Set(
        existingProducts
          .map((item) => String(item.slug ?? '').trim().toLowerCase())
          .filter(Boolean),
      )

      const hasSkuHeader = headers.includes('sku')
      const uniqueField: 'sku' | 'slug' = hasSkuHeader ? 'sku' : 'slug'

      let skipped = 0
      let failed = 0
      let toCreate = 0
      const failedRows: Array<{ row: number; reason: string }> = []
      setImportProgress({ processed: 0, total: dataRows.length })

      const createTasks = dataRows.map((cells, rowIndex) => async () => {
        const rowNo = rowIndex + 2
        const rawPayload: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          if (!header) return
          rawPayload[header] = parseImportValue(header, cells[index] ?? '')
        })

        const uniqueValue = String(rawPayload[uniqueField] ?? '').trim().toLowerCase()
        if (!uniqueValue) {
          skipped += 1
          failedRows.push({ row: rowNo, reason: `Missing unique key: ${uniqueField}` })
          return
        }

        const existingSet = uniqueField === 'sku' ? existingSkuSet : existingSlugSet
        if (existingSet.has(uniqueValue)) {
          skipped += 1
          return
        }

        const payload = Object.fromEntries(
          Object.entries(rawPayload).filter(([key]) => IMPORT_ALLOWED_FIELDS.has(key)),
        )

        if (!payload.name || !payload.slug || payload.price === '') {
          failed += 1
          failedRows.push({ row: rowNo, reason: 'Missing required fields (name/slug/price).' })
          return
        }

        if (typeof payload.category_ids === 'string') {
          try {
            payload.category_ids = JSON.parse(payload.category_ids)
          } catch {
            payload.category_ids = []
          }
        }

        try {
          const res = await fetch('/api/proxy/ecommerce/products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({} as { message?: string }))
            failed += 1
            failedRows.push({ row: rowNo, reason: body?.message ?? 'Create request failed.' })
            return
          }

          toCreate += 1
          if (payload.sku) {
            existingSkuSet.add(String(payload.sku).trim().toLowerCase())
          }
          if (payload.slug) {
            existingSlugSet.add(String(payload.slug).trim().toLowerCase())
          }
        } catch (error) {
          failed += 1
          failedRows.push({ row: rowNo, reason: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      const concurrency = 4
      let cursor = 0
      const worker = async () => {
        while (cursor < createTasks.length) {
          const taskIndex = cursor
          cursor += 1
          await createTasks[taskIndex]()
          setImportProgress((prev) => ({ ...prev, processed: prev.processed + 1 }))
        }
      }

      await Promise.all(Array.from({ length: Math.min(concurrency, createTasks.length) }, () => worker()))

      setImportSummary({
        totalRows: dataRows.length,
        toCreate,
        skipped,
        failed,
      })
      setImportFailedRows(failedRows)
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
            Import progress: {importProgress.processed} / {importProgress.total}
          </div>
          {importSummary && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>Total rows: {importSummary.totalRows}</div>
              <div>Created: {importSummary.toCreate}</div>
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
