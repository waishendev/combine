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
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Wishlisted Products" value={summary.total_wishlisted_products} />
          <SummaryCard label="Total Wishlist Adds" value={summary.total_wishlist_adds} />
          <SummaryCard label="Top Wishlisted Product" value={summary.top_wishlisted_product ?? '-'} />
          <SummaryCard label="Out-of-stock With Demand" value={summary.out_of_stock_products_with_demand} />
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500">Product Search</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product name or SKU"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date From</label>
            <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date To</label>
            <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => {
                setPage(1)
                setSearch(searchInput.trim())
              }}
            >
              Apply
            </button>
            <button
              className="rounded-md border px-4 py-2 text-sm"
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

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
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
                  <tr className="border-t" key={row.product_id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[260px]">
                        {row.image_url ? (
                          <img src={resolveImageUrl(row.image_url)} alt={row.product_name} className="h-10 w-10 rounded object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded border bg-gray-100" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{row.product_name}</div>
                          <div className="text-xs text-gray-500">{row.product_status ?? '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.sku || '-'}</td>
                    <td className="px-4 py-3">{row.category_name || '-'}</td>
                    <td className="px-4 py-3 text-right">{row.customer_wishlist_count}</td>
                    <td className="px-4 py-3 text-right">{row.guest_wishlist_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.total_wishlist_count}</td>
                    <td className="px-4 py-3 text-right">{row.current_stock ?? '-'}</td>
                    <td className="px-4 py-3">{row.last_wishlisted_at || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-gray-600">Showing {startItem} - {endItem} of {total}</div>
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
            <span className="text-gray-700">Page {page} / {lastPage}</span>
            <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page >= lastPage || loading} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}
