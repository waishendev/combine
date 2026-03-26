'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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

const toCurrency = (value: number | null | undefined) => `RM ${(Number(value ?? 0) || 0).toFixed(2)}`

export default function ProductStockMovementLogsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<ProductOption[]>([])
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<ApiMeta>({ current_page: 1, last_page: 1, per_page: 20, total: 0 })

  const [productId, setProductId] = useState(searchParams.get('product_id') ?? '')
  const [type, setType] = useState(searchParams.get('type') ?? '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') ?? '')

  const activeProductName = useMemo(() => {
    if (!productId) return null
    const selected = products.find((item) => String(item.id) === productId)
    return selected?.name ?? null
  }, [productId, products])

  const fetchProducts = async () => {
    const params = new URLSearchParams({ page: '1', per_page: '200', is_reward_only: 'false' })
    const res = await fetch(`/api/proxy/ecommerce/products?${params.toString()}`, { cache: 'no-store' })
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
  }

  const fetchRows = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(nextPage), per_page: '20' })
      if (productId) params.set('product_id', productId)
      if (type) params.set('type', type)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const res = await fetch(`/api/proxy/ecommerce/product-stock-movements?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setRows([])
        return
      }

      const json = await res.json().catch(() => null)
      const payload = json?.data
      const data = Array.isArray(payload?.data) ? payload.data : []
      setRows(data)
      setMeta({
        current_page: Number(payload?.current_page ?? nextPage) || 1,
        last_page: Number(payload?.last_page ?? 1) || 1,
        per_page: Number(payload?.per_page ?? 20) || 20,
        total: Number(payload?.total ?? data.length) || data.length,
      })
      setPage(Number(payload?.current_page ?? nextPage) || 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchProducts()
  }, [])

  useEffect(() => {
    void fetchRows(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (productId) params.set('product_id', productId)
    if (type) params.set('type', type)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const query = params.toString()
    router.replace(`/products/stock-movements${query ? `?${query}` : ''}`)
    void fetchRows(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Product</label>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Products</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.sku ? ` (${item.sku})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="stock_in">Add Stock</option>
            <option value="stock_out">Reduce Stock</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date From</label>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date To</label>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={applyFilters} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
      </div>

      {activeProductName && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Showing stock movements for <span className="font-semibold">{activeProductName}</span>.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Date / Time</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Qty Before</th>
              <th className="px-3 py-2 text-right">Qty Change</th>
              <th className="px-3 py-2 text-right">Qty After</th>
              <th className="px-3 py-2 text-right">Cost Before</th>
              <th className="px-3 py-2 text-right">Cost After</th>
              <th className="px-3 py-2 text-right">Inv Value Before</th>
              <th className="px-3 py-2 text-right">Inv Value After</th>
              <th className="px-3 py-2 text-right">Input Cost / Unit</th>
              <th className="px-3 py-2 text-left">Remark</th>
              <th className="px-3 py-2 text-left">By User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={13}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={13}>No stock movement records found.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {row.product ? (
                    <div>
                      <Link href={`/products/stock-movements?product_id=${row.product.id}`} className="text-blue-600 hover:underline">
                        {row.product.name}
                      </Link>
                      {row.variant && (
                        <div className="text-xs text-gray-500">
                          Variant: {row.variant.title ?? '—'}{row.variant.sku ? ` (${row.variant.sku})` : ''}
                        </div>
                      )}
                    </div>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">{row.type === 'stock_in' ? 'Add Stock' : 'Reduce Stock'}</td>
                <td className="px-3 py-2 text-right">{row.quantity_before}</td>
                <td className="px-3 py-2 text-right">{row.quantity_change}</td>
                <td className="px-3 py-2 text-right">{row.quantity_after}</td>
                <td className="px-3 py-2 text-right">{toCurrency(row.cost_price_before)}</td>
                <td className="px-3 py-2 text-right">{toCurrency(row.cost_price_after)}</td>
                <td className="px-3 py-2 text-right">{toCurrency(row.inventory_value_before)}</td>
                <td className="px-3 py-2 text-right">{toCurrency(row.inventory_value_after)}</td>
                <td className="px-3 py-2 text-right">{row.input_cost_price_per_unit === null ? '—' : toCurrency(row.input_cost_price_per_unit)}</td>
                <td className="px-3 py-2">{row.remark || '—'}</td>
                <td className="px-3 py-2">{row.created_by?.name || row.created_by?.email || 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          Page {meta.current_page} of {meta.last_page} · Total {meta.total}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={meta.current_page <= 1 || loading}
            onClick={() => void fetchRows(meta.current_page - 1)}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={meta.current_page >= meta.last_page || loading}
            onClick={() => void fetchRows(meta.current_page + 1)}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
