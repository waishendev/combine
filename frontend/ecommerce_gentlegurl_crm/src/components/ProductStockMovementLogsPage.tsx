'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type ProductOption = {
  id: number
  name: string
  sku: string | null
}

type MovementRow = {
  id: number
  type: 'stock_in' | 'stock_out'
  quantity_before: number
  quantity_change: number
  quantity_after: number
  cost_price_before: number
  cost_price_after: number
  inventory_value_before: number
  inventory_value_after: number
  input_cost_price_per_unit: number | null
  remark: string | null
  created_at: string
  product?: {
    id: number
    name: string
    sku?: string | null
  } | null
  variant?: {
    id: number
    title?: string | null
    sku?: string | null
    is_bundle?: boolean
  } | null
  created_by?: {
    id: number
    name?: string | null
    email?: string | null
  } | null
}

type ApiMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const DEFAULT_META: ApiMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: 0,
}

const toCurrency = (value: number | null | undefined) =>
  `RM ${(Number(value ?? 0) || 0).toFixed(2)}`

const toDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function ProductStockMovementLogsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<ProductOption[]>([])
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<ApiMeta>(DEFAULT_META)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState<MovementRow | null>(null)

  const [productId, setProductId] = useState(searchParams.get('product_id') ?? '')
  const [type, setType] = useState(searchParams.get('type') ?? '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? '')
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get('per_page') ?? 20) || 20,
  )

  const activeProductName = useMemo(() => {
    if (!productId) return null
    const selected = products.find((item) => String(item.id) === productId)
    return selected?.name ?? null
  }, [productId, products])

  const activeFilterCount = useMemo(() => {
    return [productId, type, dateFrom, dateTo].filter((value) => Boolean(value)).length
  }, [productId, type, dateFrom, dateTo])

  const syncQuery = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams()
      if (productId) params.set('product_id', productId)
      if (type) params.set('type', type)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      params.set('page', String(nextPage))
      params.set('per_page', String(pageSize))
      const query = params.toString()
      router.replace(`/products/stock-movements${query ? `?${query}` : ''}`)
    },
    [dateFrom, dateTo, pageSize, productId, router, type],
  )

  const fetchRows = useCallback(
    async (nextPage = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          per_page: String(pageSize),
        })
        if (productId) params.set('product_id', productId)
        if (type) params.set('type', type)
        if (dateFrom) params.set('date_from', dateFrom)
        if (dateTo) params.set('date_to', dateTo)

        const res = await fetch(
          `/api/proxy/ecommerce/product-stock-movements?${params.toString()}`,
          { cache: 'no-store' },
        )

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0, current_page: 1, last_page: 1 }))
          return
        }

        const json = await res.json().catch(() => null)
        const payload = json?.data
        const data = Array.isArray(payload?.data) ? (payload.data as MovementRow[]) : []
        setRows(data)
        setMeta({
          current_page: Number(payload?.current_page ?? nextPage) || 1,
          last_page: Number(payload?.last_page ?? 1) || 1,
          per_page: Number(payload?.per_page ?? pageSize) || pageSize,
          total: Number(payload?.total ?? data.length) || data.length,
        })
      } finally {
        setLoading(false)
      }
    },
    [dateFrom, dateTo, pageSize, productId, type],
  )

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      per_page: '300',
      is_reward_only: 'false',
    })
    const res = await fetch(`/api/proxy/ecommerce/products?${params.toString()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    const list = Array.isArray(json?.data?.data)
      ? json.data.data
      : Array.isArray(json?.data)
        ? json.data
        : []

    setProducts(
      list
        .map((item: unknown) => {
          const record = item as { id?: number | string; name?: string; sku?: string | null }
          return {
            id: Number(record.id) || 0,
            name: String(record.name ?? 'Unnamed Product'),
            sku: record.sku ? String(record.sku) : null,
          }
        })
        .filter((item: ProductOption) => item.id > 0),
    )
  }, [])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    void fetchRows(1)
  }, [fetchRows])

  const handleApplyFilters = () => {
    syncQuery(1)
    void fetchRows(1)
  }

  const handleRefresh = () => {
    const currentPage = meta.current_page || 1
    syncQuery(currentPage)
    void fetchRows(currentPage)
  }

  const handleResetFilters = () => {
    setProductId('')
    setType('')
    setDateFrom('')
    setDateTo('')
    setPageSize(20)
    router.replace('/products/stock-movements')
    void fetchRows(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    syncQuery(page)
    void fetchRows(page)
  }

  const colCount = 8
  const totalPages = meta.last_page || 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
          >
            <i className="fa-solid fa-filter" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <i className="fa-solid fa-rotate-right" />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="stock-movements-page-size" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="stock-movements-page-size"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isFilterOpen ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Product</label>
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Products</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.sku ? ` (${item.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Type</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="stock_in">Add Stock</option>
                <option value="stock_out">Reduce Stock</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      ) : null}

      {activeProductName ? (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Showing stock movements for <span className="font-semibold">{activeProductName}</span>.
        </div>
      ) : null}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Date / Time</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Product</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Variant</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Type</th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">Qty Change</th>
              <th className="px-4 py-2 font-semibold text-right text-gray-600 tracking-wider">Qty After</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">By User</th>
              <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              rows.map((row) => {
                const isStockIn = row.type === 'stock_in'
                const typeLabel = isStockIn ? 'Add Stock' : 'Reduce Stock'
                const typeClass = isStockIn
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
                return (
                  <tr key={row.id} className="text-sm">
                    <td className="px-4 py-2 border border-gray-200 whitespace-nowrap">
                      {toDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <p className="font-medium text-gray-900">{row.product?.name ?? '-'}</p>
                      <p className="text-xs text-gray-500">{row.product?.sku ?? '-'}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <p>{row.variant?.title ?? '-'}</p>
                      <p className="text-xs text-gray-500">{row.variant?.sku ?? '-'}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeClass}`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right font-semibold">
                      {row.quantity_change}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">{row.quantity_after}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.created_by?.name || row.created_by?.email || 'System'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setViewTarget(row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                        title="View movement detail"
                        aria-label="View movement detail"
                      >
                        <i className="fa-solid fa-eye" />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <TableEmptyState colSpan={colCount} message="No stock movement records found." />
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        {/* <span>
          Total {meta.total} records
        </span> */}
      </div>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />

      {viewTarget ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setViewTarget(null)} />
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 border-b border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Stock Movement Detail</h3>
                <button
                  type="button"
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  onClick={() => setViewTarget(null)}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Date / Time:</span> {toDateTime(viewTarget.created_at)}</p>
                <p><span className="font-semibold">Type:</span> {viewTarget.type === 'stock_in' ? 'Add Stock' : 'Reduce Stock'}</p>
                <p><span className="font-semibold">By User:</span> {viewTarget.created_by?.name || viewTarget.created_by?.email || 'System'}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Product:</span> {viewTarget.product?.name ?? '-'}</p>
                <p><span className="font-semibold">Product SKU:</span> {viewTarget.product?.sku ?? '-'}</p>
                <p><span className="font-semibold">Variant:</span> {viewTarget.variant?.title ?? '-'}</p>
                <p><span className="font-semibold">Variant SKU:</span> {viewTarget.variant?.sku ?? '-'}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Quantity Before:</span> {viewTarget.quantity_before}</p>
                <p><span className="font-semibold">Quantity Change:</span> {viewTarget.quantity_change}</p>
                <p><span className="font-semibold">Quantity After:</span> {viewTarget.quantity_after}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Cost Price Before:</span> {toCurrency(viewTarget.cost_price_before)}</p>
                <p><span className="font-semibold">Cost Price After:</span> {toCurrency(viewTarget.cost_price_after)}</p>
                <p><span className="font-semibold">Input Cost / Unit:</span> {viewTarget.input_cost_price_per_unit === null ? '-' : toCurrency(viewTarget.input_cost_price_per_unit)}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Inventory Value Before:</span> {toCurrency(viewTarget.inventory_value_before)}</p>
                <p><span className="font-semibold">Inventory Value After:</span> {toCurrency(viewTarget.inventory_value_after)}</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="font-semibold">Remark</p>
                <p className="mt-1 text-gray-700 whitespace-pre-wrap">{viewTarget.remark || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
