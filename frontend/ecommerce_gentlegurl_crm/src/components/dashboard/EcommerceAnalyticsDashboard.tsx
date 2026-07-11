'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function EcommerceAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('active')
  const [lowStock, setLowStock] = useState(false)
  const [missingCost, setMissingCost] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<InventoryItem | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), per_page: '10', status })
    if (search) params.set('search', search)
    if (category) params.set('category_id', category)
    if (lowStock) params.set('low_stock', '1')
    if (missingCost) params.set('missing_cost', '1')
    return params.toString()
  }, [category, lowStock, missingCost, page, search, status])

  useEffect(() => {
    let cancelled = false
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

  const categories = useMemo(() => Array.from(new Set(data?.items.data.map((item) => item.category).filter(Boolean) ?? [])), [data])

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Analytics</p>
            <h2 className="text-2xl font-semibold text-slate-950">Ecommerce Inventory Analytics</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['Overview', 'Ecommerce', 'Booking / Services', 'Packages'].map((tab) => (
              <span key={tab} className={`rounded-full px-4 py-2 ${tab === 'Ecommerce' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{tab}</span>
            ))}
          </div>
        </div>

        {loading && !data ? <p className="text-sm text-slate-500">Loading analytics…</p> : null}
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
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-lg font-semibold text-slate-950">Inventory Details</h3>
            <div className="flex flex-wrap gap-2">
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search product or SKU" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">All categories</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button onClick={() => setLowStock((v) => !v)} className={`rounded-xl px-3 py-2 text-sm ${lowStock ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>Low stock</button>
              <button onClick={() => setMissingCost((v) => !v)} className={`rounded-xl px-3 py-2 text-sm ${missingCost ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>Missing cost</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Product', 'SKU / Variant', 'Category', 'Status', 'Current Stock', 'Cost Per Unit', 'Retail Price', 'Inventory Cost', 'Retail Value', 'Potential Profit', 'Missing Cost', ''].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.data.map((item) => (
                  <tr key={`${item.product_id}-${item.sku_variant}`}>
                    <td className="px-3 py-3 font-medium text-slate-900">{item.product}</td>
                    <td className="px-3 py-3 text-slate-600">{item.sku_variant || '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{item.category}</td>
                    <td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{item.status}</span></td>
                    <td className="px-3 py-3">{item.current_stock}</td>
                    <td className="px-3 py-3">{money(item.cost_per_unit)}</td>
                    <td className="px-3 py-3">{money(item.retail_price)}</td>
                    <td className="px-3 py-3">{money(item.inventory_cost)}</td>
                    <td className="px-3 py-3">{money(item.retail_value)}</td>
                    <td className="px-3 py-3">{money(item.potential_profit)}</td>
                    <td className="px-3 py-3">{item.missing_cost ? <span className="text-red-600">Missing Cost</span> : '—'}</td>
                    <td className="px-3 py-3"><button onClick={() => setSelected(item)} className="text-indigo-600 hover:underline">View Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>Page {data.items.current_page} of {data.items.last_page} · {data.items.total} rows</span>
            <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button><button disabled={page >= data.items.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button></div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button className="mb-4 text-sm text-slate-500" onClick={() => setSelected(null)}>Close</button>
            <h3 className="text-xl font-semibold text-slate-950">{selected.product}</h3>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {Object.entries({ 'SKU / Variant': selected.sku_variant || '—', Category: selected.category, Status: selected.status, Stock: selected.current_stock, 'Cost Per Unit': money(selected.cost_per_unit), 'Selling Price': money(selected.retail_price), 'Current Stock Value': money(selected.inventory_cost), 'Retail Value': money(selected.retail_value), 'Potential Profit': money(selected.potential_profit), 'Historical Sold Quantity': 'Unavailable', 'Gross / Net Sales': 'Use Net Product Sales card', 'Refund History': 'Unavailable' }).map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>)}
            </dl>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
