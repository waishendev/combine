'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import CrmFormModalShell from './CrmFormModalShell'
import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import { NameStack, VariantNameStack } from './NameStack'

type ProductOption = {
  id: number
  name: string
  sku: string | null
}

type MovementSummary = {
  id: number
  type: 'stock_in' | 'stock_out' | 'reversal'
  quantity_change: number
  created_at: string
}

type MovementRow = {
  id: number
  type: 'stock_in' | 'stock_out' | 'reversal'
  quantity_before: number
  quantity_change: number
  quantity_after: number
  cost_price_before: number
  cost_price_after: number
  inventory_value_before: number
  inventory_value_after: number
  input_cost_price_per_unit: number | null
  remark: string | null
  is_revoked?: boolean
  revoked_at?: string | null
  revoked_by?: {
    id: number
    name?: string | null
    email?: string | null
  } | null
  revoke_reason?: string | null
  reversal_of_movement_id?: number | null
  original_movement?: MovementSummary | null
  reversal_movement?: MovementSummary | null
  created_at: string
  product?: {
    id: number
    name: string
    cn_name?: string | null
    sku?: string | null
  } | null
  variant?: {
    id: number
    title?: string | null
    cn_name?: string | null
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

type ProductStockMovementLogsPageProps = {
  basePath?: string
  workflow?: 'logs' | 'revoke'
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

const movementTypeLabel = (movementType: MovementRow['type']) => {
  if (movementType === 'stock_in') return 'Add Stock'
  if (movementType === 'stock_out') return 'Reduce Stock'
  return 'Reversal'
}

const movementTypeClass = (movementType: MovementRow['type']) => {
  if (movementType === 'stock_in') return 'bg-emerald-100 text-emerald-700'
  if (movementType === 'stock_out') return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
}

const canRevokeMovement = (row: MovementRow) => {
  if (row.is_revoked || row.reversal_of_movement_id || row.type === 'reversal') return false
  if (row.type !== 'stock_in' && row.type !== 'stock_out') return false
  return row.remark?.trim().toLowerCase() !== 'pos checkout'
}

export default function ProductStockMovementLogsPage({
  basePath = '/products/stock-movements',
  workflow = 'logs',
}: ProductStockMovementLogsPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<ProductOption[]>([])
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<ApiMeta>(DEFAULT_META)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState<MovementRow | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<MovementRow | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const [productId, setProductId] = useState(searchParams.get('product_id') ?? '')
  const [type, setType] = useState(searchParams.get('type') ?? '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? '')
  const isRevokeWorkflow = workflow === 'revoke'
  const defaultRevokableOnly = isRevokeWorkflow
  const [revokableOnly, setRevokableOnly] = useState(
    searchParams.has('revokable_only')
      ? searchParams.get('revokable_only') === '1'
      : defaultRevokableOnly,
  )
  const [pageSize, setPageSize] = useState(
    Number(searchParams.get('per_page') ?? 20) || 20,
  )

  const activeProductName = useMemo(() => {
    if (!productId) return null
    const selected = products.find((item) => String(item.id) === productId)
    return selected?.name ?? null
  }, [productId, products])

  const activeFilterCount = useMemo(() => {
    const revokableFilterCount = revokableOnly !== defaultRevokableOnly ? 1 : 0
    return [productId, type, dateFrom, dateTo].filter((value) => Boolean(value)).length + revokableFilterCount
  }, [dateFrom, dateTo, defaultRevokableOnly, productId, revokableOnly, type])

  const syncQuery = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams()
      if (productId) params.set('product_id', productId)
      if (type) params.set('type', type)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (revokableOnly) params.set('revokable_only', '1')
      params.set('page', String(nextPage))
      params.set('per_page', String(pageSize))
      const query = params.toString()
      router.replace(`${basePath}${query ? `?${query}` : ''}`)
    },
    [basePath, dateFrom, dateTo, pageSize, productId, revokableOnly, router, type],
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
        if (revokableOnly) params.set('revokable_only', '1')

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
    [dateFrom, dateTo, pageSize, productId, revokableOnly, type],
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
    setRevokableOnly(defaultRevokableOnly)
    setPageSize(20)
    router.replace(basePath)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    syncQuery(page)
    void fetchRows(page)
  }

  const openRevokeModal = (row: MovementRow) => {
    setRevokeTarget(row)
    setRevokeReason('')
    setRevokeError(null)
  }

  const handleConfirmRevoke = async () => {
    if (!revokeTarget || isRevoking) return

    const reason = revokeReason.trim()
    if (reason.length < 3) {
      setRevokeError('Please enter a revoke reason with at least 3 characters.')
      return
    }

    setIsRevoking(true)
    setRevokeError(null)
    try {
      const res = await fetch(`/api/proxy/ecommerce/product-stock-movements/${revokeTarget.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json().catch(() => null)

      if (!res.ok) {
        const validationMessage = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(' ')
          : null
        setRevokeError(validationMessage || json?.message || 'Unable to revoke this stock movement.')
        return
      }

      setRevokeTarget(null)
      setRevokeReason('')
      await fetchRows(meta.current_page || 1)
    } finally {
      setIsRevoking(false)
    }
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
                <option value="reversal">Reversal</option>
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
          <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={revokableOnly}
              onChange={(event) => setRevokableOnly(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Show only movements that can currently be revoked
          </label>
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

      {isRevokeWorkflow ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Review eligible manual stock movements and use the Revoke action to create an auditable reversal record.
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
                const typeLabel = movementTypeLabel(row.type)
                const typeClass = movementTypeClass(row.type)
                const isRevokable = canRevokeMovement(row)
                return (
                  <tr key={row.id} className="text-sm">
                    <td className="px-4 py-2 border border-gray-200 whitespace-nowrap">
                      {toDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <NameStack name={row.product?.name} cnName={row.product?.cn_name} fallback="-" />
                      <p className="mt-0.5 text-xs text-gray-500">{row.product?.sku ?? '-'}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <VariantNameStack name={row.variant?.title} cnName={row.variant?.cn_name} fallback="-" />
                      <p className="mt-0.5 text-xs text-gray-500">{row.variant?.sku ?? '-'}</p>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeClass}`}>
                          {typeLabel}
                        </span>
                        {row.is_revoked ? (
                          <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                            Revoked
                          </span>
                        ) : null}
                      </div>
                      {row.reversal_of_movement_id ? (
                        <p className="mt-1 text-xs text-amber-700">Reverses #{row.reversal_of_movement_id}</p>
                      ) : row.reversal_movement ? (
                        <p className="mt-1 text-xs text-gray-500">Reversal #{row.reversal_movement.id}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right font-semibold">
                      {row.quantity_change}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right">{row.quantity_after}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.created_by?.name || row.created_by?.email || 'System'}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setViewTarget(row)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                        title="View movement detail"
                        aria-label="View movement detail"
                      >
                        <i className="fa-solid fa-eye" />
                      </button>
                      {isRevokable ? (
                        <button
                          type="button"
                          onClick={() => openRevokeModal(row)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-600 text-white hover:bg-amber-700"
                          title="Revoke movement with reversal"
                          aria-label="Revoke movement with reversal"
                        >
                          <i className="fa-solid fa-rotate-left" />
                        </button>
                      ) : null}
                      </div>
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
        <div className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh]">
          <div className="flex-1 bg-black/40" onClick={() => setViewTarget(null)} />
          <div className="flex h-full min-h-0 w-full max-w-lg flex-col bg-white shadow-2xl">
            <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4">
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

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Date / Time:</span> {toDateTime(viewTarget.created_at)}</p>
                <p><span className="font-semibold">Type:</span> {movementTypeLabel(viewTarget.type)}</p>
                <p><span className="font-semibold">By User:</span> {viewTarget.created_by?.name || viewTarget.created_by?.email || 'System'}</p>
                {viewTarget.is_revoked ? (
                  <>
                    <p><span className="font-semibold">Revoked At:</span> {toDateTime(viewTarget.revoked_at)}</p>
                    <p><span className="font-semibold">Revoked By:</span> {viewTarget.revoked_by?.name || viewTarget.revoked_by?.email || 'System'}</p>
                  </>
                ) : null}
                {viewTarget.reversal_of_movement_id ? (
                  <p><span className="font-semibold">Reverses Movement:</span> #{viewTarget.reversal_of_movement_id}</p>
                ) : null}
                {viewTarget.reversal_movement ? (
                  <p><span className="font-semibold">Reversal Movement:</span> #{viewTarget.reversal_movement.id}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="font-semibold">Product:</p>
                <NameStack name={viewTarget.product?.name} cnName={viewTarget.product?.cn_name} fallback="-" />
                <p className="mt-2"><span className="font-semibold">Product SKU:</span> {viewTarget.product?.sku ?? '-'}</p>
                <p className="mt-2 font-semibold">Variant:</p>
                <VariantNameStack
                  name={viewTarget.variant?.title}
                  cnName={viewTarget.variant?.cn_name}
                  nameClassName="text-sm text-gray-900"
                  labelClassName="hidden"
                  fallback="-"
                />
                <p className="mt-2"><span className="font-semibold">Variant SKU:</span> {viewTarget.variant?.sku ?? '-'}</p>
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

              {viewTarget.revoke_reason ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">Revoke Reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-amber-800">{viewTarget.revoke_reason}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {revokeTarget ? (
        <CrmFormModalShell
          title="Revoke Stock Movement"
          onClose={() => setRevokeTarget(null)}
          closeDisabled={isRevoking}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isRevoking}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                disabled={isRevoking}
              >
                {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </>
          }
        >
          <div className="space-y-4 px-5 py-4 text-sm">
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <p className="font-semibold">This will create a reversal record, not delete history.</p>
                <p className="mt-1">The original movement will stay in the audit log and be marked as revoked.</p>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p><span className="font-semibold">Movement:</span> #{revokeTarget.id}</p>
                <p><span className="font-semibold">Date / Time:</span> {toDateTime(revokeTarget.created_at)}</p>
                <p><span className="font-semibold">Type:</span> {movementTypeLabel(revokeTarget.type)}</p>
                <p className="font-semibold">Product:</p>
                <NameStack name={revokeTarget.product?.name} cnName={revokeTarget.product?.cn_name} fallback="-" />
                <p className="mt-2 font-semibold">Variant:</p>
                <VariantNameStack
                  name={revokeTarget.variant?.title}
                  cnName={revokeTarget.variant?.cn_name}
                  nameClassName="text-sm text-gray-900"
                  labelClassName="hidden"
                  fallback="-"
                />
                <p className="mt-2"><span className="font-semibold">Quantity Change:</span> {revokeTarget.quantity_change}</p>
                <p><span className="font-semibold">Input Cost / Unit:</span> {revokeTarget.input_cost_price_per_unit === null ? '-' : toCurrency(revokeTarget.input_cost_price_per_unit)}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="revoke-reason">
                  Revoke Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="revoke-reason"
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  className="min-h-28 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Explain why this stock movement must be reversed..."
                  disabled={isRevoking}
                />
              </div>

              {revokeError ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {revokeError}
                </div>
              ) : null}
          </div>
        </CrmFormModalShell>
      ) : null}
    </div>
  )
}
