'use client'

import { useEffect, useMemo, useState } from 'react'

type ProductProfitRow = {
  product_id: number
  product_variant_id: number | null
  product_name: string
  variant_name: string | null
  sku: string | null
  quantity_sold: number
  sales_amount: number
  cost_amount: number
  gross_profit: number
  profit_margin: number
  orders_count: number
  missing_cost_items_count: number
}

type ProductProfitDetailRow = {
  order_item_id: number
  order_id: number
  order_number: string
  ordered_at: string
  quantity: number
  sale_price: number
  cost_price_snapshot: number | null
  line_total: number
  cost_amount: number
  gross_profit: number
  missing_cost: boolean
}

type ProductProfitResponse = {
  data: ProductProfitRow[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  summary?: {
    total_sales: number
    total_cost: number
    gross_profit: number
    profit_margin: number
    quantity_sold: number
    orders_count: number
    missing_cost_items_count: number
  }
  details?: ProductProfitDetailRow[]
}

type CategoryOption = {
  id: number
  name: string
}

type Props = {
  initialDateFrom?: string
  initialDateTo?: string
  initialSearch?: string
}

export default function ProductProfitReportPage({ initialDateFrom = '', initialDateTo = '', initialSearch = '' }: Props) {
  const [rows, setRows] = useState<ProductProfitRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [search, setSearch] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [categoryId, setCategoryId] = useState('')
  const [channel, setChannel] = useState('')

  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [summary, setSummary] = useState<ProductProfitResponse['summary']>()
  const [categories, setCategories] = useState<CategoryOption[]>([])

  const [selectedRow, setSelectedRow] = useState<ProductProfitRow | null>(null)
  const [details, setDetails] = useState<ProductProfitDetailRow[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

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
        if (categoryId) qs.set('category_id', categoryId)
        if (channel) qs.set('channel', channel)

        const res = await fetch(`/api/proxy/admin/reports/product-profit?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({})) as Partial<ProductProfitResponse> & { message?: string }

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load product profit report')
        }

        setRows(data.data ?? [])
        setTotal(data.total ?? 0)
        setLastPage(data.last_page ?? 1)
        setSummary(data.summary)
        setSelectedRow(null)
        setDetails([])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load product profit report')
      } finally {
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [page, perPage, search, dateFrom, dateTo, categoryId, channel])

  useEffect(() => {
    const controller = new AbortController()

    const loadCategories = async () => {
      try {
        const res = await fetch('/api/proxy/ecommerce/categories?page=1&per_page=500', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({})) as { data?: CategoryOption[] }
        if (res.ok) setCategories(data.data ?? [])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }

    loadCategories()
    return () => controller.abort()
  }, [])

  const loadDetails = async (row: ProductProfitRow) => {
    setSelectedRow(row)
    setDetailsLoading(true)
    setDetailsError(null)
    try {
      const qs = new URLSearchParams({
        include_details: '1',
        product_id: String(row.product_id),
        page: '1',
        per_page: '1',
      })
      if (row.product_variant_id) qs.set('product_variant_id', String(row.product_variant_id))
      if (search) qs.set('search', search)
      if (dateFrom) qs.set('date_from', dateFrom)
      if (dateTo) qs.set('date_to', dateTo)
      if (categoryId) qs.set('category_id', categoryId)
      if (channel) qs.set('channel', channel)

      const res = await fetch(`/api/proxy/admin/reports/product-profit?${qs.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({})) as Partial<ProductProfitResponse> & { message?: string }
      if (!res.ok) throw new Error(data.message || 'Failed to load order item breakdown')
      setDetails(data.details ?? [])
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Failed to load order item breakdown')
      setDetails([])
    } finally {
      setDetailsLoading(false)
    }
  }

  const startItem = total === 0 ? 0 : (page - 1) * perPage + 1
  const endItem = Math.min(page * perPage, total)

  const summaryCards = useMemo(() => [
    { label: 'Total Sales', value: formatMoney(summary?.total_sales ?? 0), accent: 'blue' as const },
    { label: 'Total Cost', value: formatMoney(summary?.total_cost ?? 0), accent: 'slate' as const },
    { label: 'Gross Profit', value: formatMoney(summary?.gross_profit ?? 0), accent: 'emerald' as const },
    { label: 'Profit Margin', value: `${formatNumber(summary?.profit_margin ?? 0)}%`, accent: 'indigo' as const },
    { label: 'Quantity Sold', value: summary?.quantity_sold ?? 0, accent: 'amber' as const },
    { label: 'Missing Cost Items', value: summary?.missing_cost_items_count ?? 0, accent: 'rose' as const },
  ], [summary])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This report uses <strong>order_items cost snapshots</strong>. Missing cost snapshots are treated as RM 0.00 and flagged.
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="text-sm font-medium text-slate-700">
            Date From
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Date To
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
          </label>
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Product / SKU
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Search product, variant, SKU" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); setPage(1) } }} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Category
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}>
              <option value="">All</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Channel
            <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1) }}>
              <option value="">All</option>
              <option value="online">Online</option>
              <option value="pos">POS</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { setSearch(searchInput.trim()); setPage(1) }}>Apply</button>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setSearchInput(''); setSearch(''); setDateFrom(''); setDateTo(''); setCategoryId(''); setChannel(''); setPage(1) }}>Reset</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Variant / SKU</th>
                <th className="px-4 py-3 text-right">Quantity Sold</th>
                <th className="px-4 py-3 text-right">Sales Amount</th>
                <th className="px-4 py-3 text-right">Cost Amount</th>
                <th className="px-4 py-3 text-right">Gross Profit</th>
                <th className="px-4 py-3 text-right">Profit Margin %</th>
                <th className="px-4 py-3 text-right">Orders Count</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>Loading product profit report...</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-6 text-center text-red-600" colSpan={8}>{error}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>No product profit data found.</td></tr>
              ) : rows.map((row) => (
                <tr key={`${row.product_id}:${row.product_variant_id ?? 'base'}`} className="cursor-pointer border-t hover:bg-blue-50/40" onClick={() => loadDetails(row)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.product_name}</div>
                    {row.missing_cost_items_count > 0 && <MissingCostBadge count={row.missing_cost_items_count} />}
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.variant_name || 'Base product'}</div>
                    <div className="text-xs text-slate-500">{row.sku || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{row.quantity_sold}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.sales_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(row.cost_amount)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${row.gross_profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(row.gross_profit)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.profit_margin)}%</td>
                  <td className="px-4 py-3 text-right">{row.orders_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div className="text-slate-600">Showing {startItem} - {endItem} of {total}</div>
          <div className="flex items-center gap-2">
            <select className="rounded-md border px-2 py-1" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}>
              {[15, 30, 50, 100].map((size) => <option key={size} value={size}>{size}/page</option>)}
            </select>
            <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span className="text-slate-700">Page {page} / {lastPage}</span>
            <button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page >= lastPage || loading} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>Next</button>
          </div>
        </div>
      </div>

      {selectedRow && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="font-semibold text-slate-900">Order Item Breakdown</div>
            <div className="text-sm text-slate-500">{selectedRow.product_name} {selectedRow.variant_name ? `· ${selectedRow.variant_name}` : ''}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Order No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Sale Price</th>
                  <th className="px-4 py-3 text-right">Cost Price Snapshot</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                  <th className="px-4 py-3 text-right">Cost Amount</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {detailsLoading ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>Loading breakdown...</td></tr>
                ) : detailsError ? (
                  <tr><td className="px-4 py-6 text-center text-red-600" colSpan={8}>{detailsError}</td></tr>
                ) : details.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>No breakdown rows found.</td></tr>
                ) : details.map((detail) => (
                  <tr key={detail.order_item_id} className="border-t">
                    <td className="px-4 py-3">{detail.order_number}</td>
                    <td className="px-4 py-3">{formatDate(detail.ordered_at)}</td>
                    <td className="px-4 py-3 text-right">{detail.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(detail.sale_price)}</td>
                    <td className="px-4 py-3 text-right">{detail.cost_price_snapshot === null ? <MissingCostBadge /> : formatMoney(detail.cost_price_snapshot)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(detail.line_total)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(detail.cost_amount)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${detail.gross_profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(detail.gross_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: 'blue' | 'slate' | 'emerald' | 'indigo' | 'amber' | 'rose' }) {
  const accentClass = {
    blue: 'from-blue-50 to-blue-100/40 border-blue-200 text-blue-900',
    slate: 'from-slate-50 to-slate-100/40 border-slate-200 text-slate-900',
    emerald: 'from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900',
    indigo: 'from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-900',
    amber: 'from-amber-50 to-amber-100/40 border-amber-200 text-amber-900',
    rose: 'from-rose-50 to-rose-100/40 border-rose-200 text-rose-900',
  }[accent]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function MissingCostBadge({ count }: { count?: number }) {
  return <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">Missing cost{count ? ` (${count})` : ''}</span>
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value || 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
