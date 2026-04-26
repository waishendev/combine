'use client'

import { useEffect, useMemo, useState } from 'react'

import { resolveImageUrl } from '@/utils/resolveImageUrl'

type WishlistRow = {
  product_id: number
  product_name: string
  sku: string | null
  image_url: string | null
  category_name: string | null
  customer_wishlist_count: number
  guest_wishlist_count: number
  total_wishlist_count: number
  current_stock: number | null
  low_stock_threshold?: number | null
  product_status: string | null
  last_wishlisted_at: string | null
}

type WishlistResponse = {
  data: WishlistRow[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  summary?: {
    total_wishlisted_products: number
    total_wishlist_adds: number
    top_wishlisted_product: string | null
    out_of_stock_products_with_demand: number
  }
}

type Props = {
  initialDateFrom?: string
  initialDateTo?: string
  initialSearch?: string
}

export default function WishlistReportPage({ initialDateFrom = '', initialDateTo = '', initialSearch = '' }: Props) {
  const [rows, setRows] = useState<WishlistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [search, setSearch] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)

  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [summary, setSummary] = useState<WishlistResponse['summary']>()

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({
          page: String(page),
          per_page: String(perPage),
        })

        if (search) qs.set('search', search)
        if (dateFrom) qs.set('date_from', dateFrom)
        if (dateTo) qs.set('date_to', dateTo)

        const res = await fetch(`/api/proxy/ecommerce/reports/wishlist?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(`Failed to load wishlist report (${res.status})`)
        }

        const payload: WishlistResponse = await res.json()
        setRows(payload.data ?? [])
        setTotal(payload.total ?? 0)
        setLastPage(Math.max(payload.last_page ?? 1, 1))
        setSummary(payload.summary)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load wishlist report.')
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => controller.abort()
  }, [page, perPage, search, dateFrom, dateTo])

  const startItem = useMemo(() => (total === 0 ? 0 : (page - 1) * perPage + 1), [page, perPage, total])
  const endItem = useMemo(() => Math.min(page * perPage, total), [page, perPage, total])

  return (
    <div className="space-y-5">
      {summary ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Wishlist Adds" value={summary.total_wishlist_adds} accent="blue" />
          <SummaryCard label="Total Wishlisted Products" value={summary.total_wishlisted_products} accent="indigo" />
          <SummaryCard label="Top Wishlisted Product" value={summary.top_wishlisted_product ?? '-'} accent="emerald" />
          <SummaryCard label="Out-of-stock Products With Wishlist Demand" value={summary.out_of_stock_products_with_demand} accent="rose" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="text-xs text-gray-500">Product Search</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product name or SKU"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Date From</label>
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Date To</label>
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex gap-2 md:col-span-3 md:justify-end">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                setPage(1)
                setSearch(searchInput.trim())
              }}
            >
              Apply
            </button>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setDateFrom('')
                setDateTo('')
                setPage(1)
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Customer Wishlist Count</th>
                <th className="px-4 py-3 text-right">Guest Wishlist Count</th>
                <th className="px-4 py-3 text-right">Total Wishlist Count</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-left">Last Wishlisted At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>Loading wishlist report...</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-6 text-center text-red-600" colSpan={8}>{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>No wishlist data found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr
                    className={`border-t ${row.current_stock !== null && row.current_stock <= 0 && row.total_wishlist_count >= 3 ? 'bg-rose-50/80' : ''}`}
                    key={row.product_id}
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-[260px] items-center gap-3">
                        {row.image_url ? (
                          <img src={resolveImageUrl(row.image_url)} alt={row.product_name} className="h-10 w-10 rounded object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded border bg-gray-100" />
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{row.product_name}</div>
                          <div className="text-xs text-slate-500">{row.product_status ?? '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.sku || '-'}</td>
                    <td className="px-4 py-3">{row.category_name || '-'}</td>
                    <td className="px-4 py-3 text-right">{row.customer_wishlist_count}</td>
                    <td className="px-4 py-3 text-right">{row.guest_wishlist_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.total_wishlist_count}</td>
                    <td className="px-4 py-3 text-right">
                      <StockBadge currentStock={row.current_stock} lowStockThreshold={row.low_stock_threshold ?? null} />
                    </td>
                    <td className="px-4 py-3">{row.last_wishlisted_at || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div className="text-slate-600">Showing {startItem} - {endItem} of {total}</div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border px-2 py-1"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value))
                setPage(1)
              }}
            >
              {[15, 30, 50].map((size) => (
                <option key={size} value={size}>{size}/page</option>
              ))}
            </select>
            <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span className="text-slate-700">Page {page} / {lastPage}</span>
            <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page >= lastPage || loading} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: 'blue' | 'indigo' | 'emerald' | 'rose' }) {
  const accentClass = {
    blue: 'from-blue-50 to-blue-100/40 border-blue-200 text-blue-900',
    indigo: 'from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-900',
    emerald: 'from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900',
    rose: 'from-rose-50 to-rose-100/40 border-rose-200 text-rose-900',
  }[accent]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function StockBadge({ currentStock, lowStockThreshold }: { currentStock: number | null; lowStockThreshold: number | null }) {
  if (currentStock === null) {
    return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Unknown</span>
  }

  if (currentStock <= 0) {
    return <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">Out of stock</span>
  }

  const threshold = lowStockThreshold && lowStockThreshold > 0 ? lowStockThreshold : 5
  if (currentStock <= threshold) {
    return <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Low stock ({currentStock})</span>
  }

  return <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">In stock ({currentStock})</span>
}
