'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ReportDetailDrawer, ReportViewDetailsButton } from '@/components/reports/ReportActions'
import { apiFetch } from '@/lib/api'

type InventoryItem = {
  product_id: number
  product: string
  sku_variant: string | null
  category: string
  status: string
  current_stock: number
  cost_per_unit: number | null
  retail_price: number
  inventory_cost: number
  retail_value: number
  potential_profit: number
  missing_cost: boolean
}

type AnalyticsResponse = {
  products: { active_count: number; sku_count: number; current_stock_qty: number; missing_cost_count: number; low_stock_count: number }
  inventory: { current_cost: number; retail_value: number; potential_gross_profit: number; potential_margin_percent: number }
  sales: { gross_product_sales: number; refund_amount: number; refund_available?: boolean; net_product_sales: number }
  items: { data: InventoryItem[]; current_page: number; last_page: number; total: number }
}

const money = (value: number | null | undefined) =>
  value == null ? 'Missing' : new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value)

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  )
}

function DrawerMetricCard({
  label,
  value,
  note,
  accent = 'slate',
}: {
  label: string
  value: string
  note?: string
  accent?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose'
}) {
  const accentClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  }[accent]

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accentClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {note ? <p className="mt-1 text-xs opacity-70">{note}</p> : null}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function InventoryDetailDrawer({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const marginPercent =
    item.retail_price > 0 && item.cost_per_unit != null
      ? (((item.retail_price - item.cost_per_unit) / item.retail_price) * 100).toFixed(1)
      : null

  return (
    <ReportDetailDrawer
      open
      maxWidthClassName="max-w-4xl"
      title={item.product}
      subtitle={item.sku_variant ? <p className="text-sm text-slate-600">{item.sku_variant}</p> : undefined}
      onClose={onClose}
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <DrawerMetricCard label="Current Stock" value={`${item.current_stock} units`} accent="indigo" />
          <DrawerMetricCard label="Inventory Cost" value={money(item.inventory_cost)} accent="slate" />
          <DrawerMetricCard label="Retail Value" value={money(item.retail_value)} accent="emerald" />
          <DrawerMetricCard
            label="Potential Profit"
            value={money(item.potential_profit)}
            note={marginPercent ? `${marginPercent}% unit margin` : undefined}
            accent={item.potential_profit < 0 ? 'rose' : 'emerald'}
          />
        </div>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Product Information</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="SKU / Variant" value={item.sku_variant || '—'} />
            <DetailField label="Category" value={item.category} />
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pricing & Inventory</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Cost Per Unit" value={money(item.cost_per_unit)} />
            <DetailField label="Retail Price" value={money(item.retail_price)} />
            <DetailField label="Stock on Hand" value={`${item.current_stock} units`} />
            <DetailField label="Unit Margin" value={marginPercent ? `${marginPercent}%` : '—'} />
          </div>
        </section>
      </div>
    </ReportDetailDrawer>
  )
}

type CategoryOption = {
  id: number
  name: string
}

const PER_PAGE = 10

type EcommerceAnalyticsDashboardProps = {
  onInitialLoad?: () => void
}

export default function EcommerceAnalyticsDashboard({ onInitialLoad }: EcommerceAnalyticsDashboardProps = {}) {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<InventoryItem | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE), status: 'active' })
    if (search) params.set('search', search)
    if (category) params.set('category_id', category)
    return params.toString()
  }, [category, page, search])

  const hasActiveFilters = Boolean(search || category)

  useEffect(() => {
    let cancelled = false

    fetch('/api/proxy/ecommerce/categories?page=1&per_page=500', { cache: 'no-store' })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({})) as { data?: { data?: CategoryOption[] } | CategoryOption[] }
        if (cancelled || !res.ok) return
        const rows = Array.isArray(payload.data) ? payload.data : payload.data?.data
        setCategories(Array.isArray(rows) ? rows.filter((row) => row?.id && row?.name) : [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch<AnalyticsResponse>(`/api/admin/dashboard/analytics/ecommerce?${query}`)
      .then((response) => {
        if (!cancelled) {
          setData(response)
          setError(null)
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load analytics'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    if (!hasInitiallyLoaded && !loading) {
      setHasInitiallyLoaded(true)
      onInitialLoad?.()
    }
  }, [hasInitiallyLoaded, loading, onInitialLoad])

  const applySearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setPage(1)
  }

  const totalRows = data?.items.total ?? 0
  const lastPage = data?.items.last_page ?? 1
  const currentPage = data?.items.current_page ?? page
  const startItem = totalRows === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1
  const endItem = Math.min(currentPage * PER_PAGE, totalRows)

  if (!hasInitiallyLoaded) {
    if (error && !data) {
      return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
    }
    return null
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Analytics</p>
          <h2 className="text-2xl font-semibold text-slate-950">Ecommerce Inventory Analytics</h2>
        </div>

        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Active Products" value={String(data.products.active_count)} note={`${data.products.sku_count} total SKUs / variants`} />
              <MetricCard label="Current Stock" value={`${data.products.current_stock_qty} units`} />
              <MetricCard label="Current Stock Cost" value={money(data.inventory.current_cost)} />
              <MetricCard label="Total Retail Value" value={money(data.inventory.retail_value)} />
              <MetricCard label="Potential Gross Profit" value={money(data.inventory.potential_gross_profit)} note={`${data.inventory.potential_margin_percent}% margin`} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Net Product Sales" value={money(data.sales.net_product_sales)} note={`Gross ${money(data.sales.gross_product_sales)}`} />
              <MetricCard label="Refunds" value={data.sales.refund_available === false ? 'Not Available' : money(data.sales.refund_amount)} />
              <MetricCard label="Low Stock" value={String(data.products.low_stock_count)} />
              <MetricCard label="Missing Cost" value={String(data.products.missing_cost_count)} />
            </div>
          </>
        ) : null}
      </div>

      {data ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <h3 className="text-lg font-semibold text-slate-950">Inventory Details</h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700 sm:max-w-xs">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden="true" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applySearch()
                    }}
                    placeholder="Product or SKU"
                    className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </label>
              <label className="min-w-[180px] text-sm font-medium text-slate-700">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setPage(1)
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">All categories</option>
                  {categories.map((option) => (
                    <option key={option.id} value={String(option.id)}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={applySearch}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                Search
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5 text-right">Current Stock</th>
                    <th className="px-4 py-3.5 text-right">Cost Per Unit</th>
                    <th className="px-4 py-3.5 text-right">Retail Price</th>
                    <th className="px-4 py-3.5 text-right">Inventory Cost</th>
                    <th className="px-4 py-3.5 text-right">Retail Value</th>
                    <th className="px-4 py-3.5 text-right">Potential Profit</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                        <i className="fa-solid fa-spinner fa-spin mr-2 text-slate-400" aria-hidden="true" />
                        Loading inventory…
                      </td>
                    </tr>
                  ) : data.items.data.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-slate-500">
                          <i className="fa-solid fa-box-open text-2xl text-slate-300" aria-hidden="true" />
                          <p className="text-sm font-medium text-slate-700">No inventory rows found</p>
                          <p className="text-xs">Try adjusting your search or category filter.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.items.data.map((item) => (
                      <tr key={`${item.product_id}-${item.sku_variant}`} className="transition hover:bg-indigo-50/40">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-900">{item.product}</p>
                          {item.sku_variant ? <p className="mt-0.5 text-xs text-slate-500">{item.sku_variant}</p> : null}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{item.category}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{item.current_stock}</td>
                        <td className={`px-4 py-3.5 text-right tabular-nums ${item.missing_cost ? 'font-medium text-amber-700' : 'text-slate-700'}`}>
                          {money(item.cost_per_unit)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{money(item.retail_price)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{money(item.inventory_cost)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{money(item.retail_value)}</td>
                        <td className={`px-4 py-3.5 text-right tabular-nums font-medium ${item.potential_profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {money(item.potential_profit)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <ReportViewDetailsButton onClick={() => setSelected(item)} title={`View details for ${item.product}`} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-600">
                Showing <span className="font-medium text-slate-900">{startItem}</span>
                {' - '}
                <span className="font-medium text-slate-900">{endItem}</span>
                {' of '}
                <span className="font-medium text-slate-900">{totalRows}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true" />
                  Previous
                </button>
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                  Page {currentPage} / {lastPage}
                </span>
                <button
                  type="button"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selected ? <InventoryDetailDrawer item={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}
