'use client'

import { useEffect, useMemo, useState } from 'react'

import { NameStack } from '@/components/NameStack'
import { topWishlistCardContent, wishlistStockDisplay } from '@/lib/wishlistReport'
import { resolveImageUrl } from '@/utils/resolveImageUrl'

type WishlistRow = {
  product_id: number
  product_name: string
  product_cn_name?: string | null
  sku: string | null
  image_url: string | null
  category_name: string | null
  customer_wishlist_count: number
  guest_wishlist_count: number
  total_wishlist_count: number
  current_stock: number | null
  stock_status: 'in_stock' | 'partial' | 'out_of_stock'
  has_variants: boolean
  variant_count: number
  out_of_stock_variant_count: number
  low_stock_threshold?: number | null
  product_status: string | null
  last_wishlisted_at: string | null
}

type TopWishlistedProduct = {
  product_id: number
  product_name: string
  sku: string | null
  total_wishlist_count: number
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
    top_wishlist_count: number
    top_wishlisted_product_count: number
    top_wishlisted_is_tie: boolean
    top_wishlisted_products?: TopWishlistedProduct[]
    out_of_stock_products_with_demand: number
  }
}

type VariantDetail = {
  product: { id: number; name: string; cn_name?: string | null }
  variants: Array<{ id: number; name: string; cn_name?: string | null; sku: string; current_stock: number | null; stock_status: 'in_stock' | 'out_of_stock' }>
  wishlist_identity: 'product'
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
  const [detailProduct, setDetailProduct] = useState<WishlistRow | null>(null)
  const [variantDetail, setVariantDetail] = useState<VariantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [showTiedProducts, setShowTiedProducts] = useState(false)

  const openVariantDetail = async (row: WishlistRow) => {
    setDetailProduct(row)
    setVariantDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/reports/wishlist/products/${row.product_id}/inventory-detail`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load variant stock details (${res.status})`)
      setVariantDetail(await res.json())
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load variant stock details.')
    } finally {
      setDetailLoading(false)
    }
  }

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
  const topWishlistCard = useMemo(
    () => (summary ? topWishlistCardContent(summary) : null),
    [summary],
  )

  return (
    <div className="space-y-5">
      {summary && topWishlistCard ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Wishlist Adds" value={summary.total_wishlist_adds} accent="blue" />
          <SummaryCard label="Total Wishlisted Products" value={summary.total_wishlisted_products} accent="indigo" />
          <SummaryCard
            label={topWishlistCard.label}
            value={topWishlistCard.primary}
            secondary={topWishlistCard.secondary}
            badge={topWishlistCard.badge}
            accent="emerald"
            onView={
              summary.top_wishlisted_is_tie && (summary.top_wishlisted_products?.length ?? 0) > 0
                ? () => setShowTiedProducts(true)
                : undefined
            }
            viewLabel="View tied products"
          />
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
              placeholder="Search product name, Chinese name or SKU"
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
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>Loading wishlist report...</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-6 text-center text-red-600" colSpan={9}>{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={9}>No wishlist data found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr
                    className={`border-t ${row.stock_status === 'out_of_stock' && row.total_wishlist_count >= 3 ? 'bg-rose-50/80' : ''}`}
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
                          <NameStack
                            name={row.product_name}
                            cnName={row.product_cn_name}
                            primaryClassName="font-medium text-slate-900"
                            secondaryClassName="mt-0.5 text-xs text-slate-500"
                          />
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
                      <StockBadge row={row} />
                    </td>
                    <td className="px-4 py-3">{row.last_wishlisted_at || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {row.has_variants ? (
                        <button type="button" onClick={() => void openVariantDetail(row)} className="inline-flex rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600" aria-label={`View variant stock for ${row.product_name}`} title="View variant stock">
                          <EyeIcon />
                        </button>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
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
      {detailProduct ? (
        <VariantStockModal
          product={detailProduct}
          detail={variantDetail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailProduct(null)}
        />
      ) : null}
      {showTiedProducts && summary?.top_wishlisted_products ? (
        <TiedProductsModal
          products={summary.top_wishlisted_products}
          onClose={() => setShowTiedProducts(false)}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  secondary,
  badge,
  accent,
  onView,
  viewLabel,
}: {
  label: string
  value: string | number
  secondary?: string
  badge?: string
  accent: 'blue' | 'indigo' | 'emerald' | 'rose'
  onView?: () => void
  viewLabel?: string
}) {
  const accentClass = {
    blue: 'from-blue-50 to-blue-100/40 border-blue-200 text-blue-900',
    indigo: 'from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-900',
    emerald: 'from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900',
    rose: 'from-rose-50 to-rose-100/40 border-rose-200 text-rose-900',
  }[accent]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs opacity-80">{label}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge ? (
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-300/60">
              {badge}
            </span>
          ) : null}
          {onView ? (
            <button
              type="button"
              onClick={onView}
              className="inline-flex rounded-lg border border-emerald-300/70 bg-white/70 p-1.5 text-emerald-800 hover:bg-white"
              aria-label={viewLabel ?? 'View details'}
              title={viewLabel ?? 'View details'}
            >
              <EyeIcon />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1 text-xl font-semibold leading-snug break-words">{value}</div>
      {secondary ? <div className="mt-1 text-xs font-medium opacity-75">{secondary}</div> : null}
    </div>
  )
}

function StockBadge({ row }: { row: WishlistRow }) {
  const display = wishlistStockDisplay(row)
  const classes = { slate: 'bg-slate-100 text-slate-600', rose: 'bg-rose-100 text-rose-700', amber: 'bg-amber-100 text-amber-700', emerald: 'bg-emerald-100 text-emerald-700' }[display.tone]
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${classes}`}>{display.label}</span>
}

function TiedProductsModal({
  products,
  onClose,
}: {
  products: TopWishlistedProduct[]
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tied-products-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <h3 id="tied-products-title" className="text-lg font-semibold text-slate-900">
            Tied top products
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close tied products">
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-5">
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {products.map((product) => (
              <li key={product.product_id} className="px-4 py-3">
                <p className="truncate font-medium text-slate-900">{product.product_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{product.sku ? `SKU: ${product.sku}` : 'No SKU'}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function EyeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
}

function VariantStockModal({ product, detail, loading, error, onClose }: { product: WishlistRow; detail: VariantDetail | null; loading: boolean; error: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="variant-stock-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div><h3 id="variant-stock-title" className="text-lg font-semibold text-slate-900">Variant Stock Details</h3><p className="mt-1 text-sm text-slate-600">Product: {product.product_name}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close variant stock details">✕</button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-5">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading variant stock details...</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {detail ? <>
            <table className="min-w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 text-left">Variant</th><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-right">Current Stock</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
              <tbody>{detail.variants.map((variant) => <tr key={variant.id} className="border-t"><td className="px-3 py-3"><NameStack name={variant.name} cnName={variant.cn_name} primaryClassName="font-medium text-slate-900" secondaryClassName="text-xs text-slate-500" /></td><td className="px-3 py-3">{variant.sku || '-'}</td><td className="px-3 py-3 text-right">{variant.current_stock ?? 'Not tracked'}</td><td className="px-3 py-3">{variant.stock_status === 'in_stock' ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">In stock</span> : <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">Out of stock</span>}</td></tr>)}</tbody>
            </table>
          </> : null}
        </div>
      </div>
    </div>
  )
}
