'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

type Summary = {
  templates: { total: number; active: number; inactive: number; missing_redemption_value_count: number }
  customers: { active_holders: number; active_customer_packages: number }
  balances: { remaining_redemptions: number; outstanding_service_value: number }
  sales: { gross_package_sales: number; refund_amount: number; net_package_sales: number }
  redemptions: { redeemed_qty: number; redeemed_value: number }
  status: { expiring_soon: number; exhausted: number; expired: number; cancelled: number }
}

type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
type Liability = { id: number; customer: string; package: string; purchased_from: string; purchase_date: string; started_at: string | null; expires_at: string | null; status: string; total_qty: number; used_qty: number; remaining_qty: number; purchase_amount: number; remaining_service_value: number; missing_values: number }
type Sale = { reference_no: string; customer: string; package: string; channel: string; payment_method: string | null; purchased_from: string; gross_amount: number; discount: number; refund_amount: number; net_amount: number; status: string; purchased_at: string }
type Redemption = { id: number; usage_date: string; booking_no: string | null; customer: string; package: string; service: string; used_qty: number; redemption_value_per_unit: number; total_redemption_value: number; source: string; status: string }

type Detail = { package: Record<string, unknown>; balances: Array<Record<string, unknown>>; usages: Array<Record<string, unknown>> }

const money = (value: number | null | undefined) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value ?? 0))
const dateText = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-MY') : '—'

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>{note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}</div>
}

export default function PackageAnalyticsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [liability, setLiability] = useState<Page<Liability> | null>(null)
  const [sales, setSales] = useState<Page<Sale> | null>(null)
  const [redemptions, setRedemptions] = useState<Page<Redemption> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    let cancelled = false
    const q = new URLSearchParams({ per_page: '10' })
    if (search) q.set('search', search)
    if (status) q.set('status', status)
    Promise.all([
      apiFetch<Summary>('/api/admin/dashboard/analytics/packages/summary'),
      apiFetch<Page<Liability>>(`/api/admin/dashboard/analytics/packages/customer-packages?${q}`),
      apiFetch<Page<Sale>>('/api/admin/dashboard/analytics/packages/sales?per_page=10'),
      apiFetch<Page<Redemption>>('/api/admin/dashboard/analytics/packages/redemptions?per_page=10'),
    ]).then(([summaryData, liabilityData, salesData, redemptionData]) => {
      if (!cancelled) { setSummary(summaryData); setLiability(liabilityData); setSales(salesData); setRedemptions(redemptionData); setError(null) }
    }).catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load package analytics'))
    return () => { cancelled = true }
  }, [search, status])

  const openDetail = (id: number) => apiFetch<Detail>(`/api/admin/dashboard/analytics/packages/customer-packages/${id}`).then(setDetail).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load details'))

  if (error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
  if (!summary) return <p className="text-sm text-slate-500">Loading package analytics…</p>

  return <section className="space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-2"><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Analytics</p><h2 className="text-2xl font-semibold text-slate-950">Package Analytics</h2><p className="text-sm text-slate-600">Purchase revenue is reported separately from internal redemption value owed to customers.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Package Templates" value={String(summary.templates.total)} note={`${summary.templates.active} active · ${summary.templates.inactive} inactive`} />
        <MetricCard label="Active Package Holders" value={String(summary.customers.active_holders)} note="Current-state" />
        <MetricCard label="Active Customer Packages" value={String(summary.customers.active_customer_packages)} note="Current-state" />
        <MetricCard label="Package Sales Revenue" value={money(summary.sales.net_package_sales)} note={`Gross ${money(summary.sales.gross_package_sales)}`} />
        <MetricCard label="Remaining Redemptions" value={String(summary.balances.remaining_redemptions)} note="Current-state" />
        <MetricCard label="Outstanding Package Service Value" value={money(summary.balances.outstanding_service_value)} note="Unused balance value" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Redeemed Package Value" value={money(summary.redemptions.redeemed_value)} note={`${summary.redemptions.redeemed_qty} uses`} />
        <MetricCard label="Expiring Soon" value={String(summary.status.expiring_soon)} note="Next 30 days" />
        <MetricCard label="Exhausted Packages" value={String(summary.status.exhausted)} />
        <MetricCard label="Expired Packages" value={String(summary.status.expired)} />
        <MetricCard label="Cancelled Packages" value={String(summary.status.cancelled)} />
        <MetricCard label="Missing Redemption Value" value={String(summary.templates.missing_redemption_value_count)} />
      </div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Customer Package Liability</h3><div className="flex gap-2"><input className="rounded-xl border px-3 py-2 text-sm" placeholder="Search customer/package" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="exhausted">Exhausted</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select><button className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Export CSV</button></div></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{['Customer','Package','Purchased From','Purchase Date','Started At','Expires At','Status','Total','Used','Remaining','Purchase Amount','Remaining Service Value','Expiry Warning',''].map(h=><th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{liability?.data.map(row=><tr className="border-t" key={row.id}><td className="px-3 py-3">{row.customer}</td><td className="px-3 py-3">{row.package}{row.missing_values > 0 ? <span className="ml-2 text-red-600">Missing value</span> : null}</td><td className="px-3 py-3">{row.purchased_from}</td><td className="px-3 py-3">{dateText(row.purchase_date)}</td><td className="px-3 py-3">{dateText(row.started_at)}</td><td className="px-3 py-3">{dateText(row.expires_at)}</td><td className="px-3 py-3">{row.status}</td><td className="px-3 py-3">{row.total_qty}</td><td className="px-3 py-3">{row.used_qty}</td><td className="px-3 py-3">{row.remaining_qty}</td><td className="px-3 py-3">{money(row.purchase_amount)}</td><td className="px-3 py-3">{money(row.remaining_service_value)}</td><td className="px-3 py-3">{row.expires_at ? dateText(row.expires_at) : 'No expiry'}</td><td className="px-3 py-3"><button className="text-indigo-600" onClick={() => openDetail(row.id)}>View Details</button></td></tr>)}</tbody></table></div></div>

    <div className="grid gap-6 xl:grid-cols-2"><div className="rounded-3xl border bg-white p-4 shadow-sm"><h3 className="mb-4 text-lg font-semibold">Package Sales</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><tbody>{sales?.data.map(row=><tr className="border-t" key={row.reference_no}><td className="px-3 py-3">{row.reference_no}</td><td className="px-3 py-3">{row.customer}</td><td className="px-3 py-3">{row.package}</td><td className="px-3 py-3">{money(row.net_amount)}</td><td className="px-3 py-3">{dateText(row.purchased_at)}</td></tr>)}</tbody></table></div></div><div className="rounded-3xl border bg-white p-4 shadow-sm"><h3 className="mb-4 text-lg font-semibold">Package Redemption Activity</h3><div className="overflow-x-auto"><table className="min-w-full text-sm"><tbody>{redemptions?.data.map(row=><tr className="border-t" key={row.id}><td className="px-3 py-3">{dateText(row.usage_date)}</td><td className="px-3 py-3">{row.customer}</td><td className="px-3 py-3">{row.service}</td><td className="px-3 py-3">{row.used_qty}</td><td className="px-3 py-3">{money(row.total_redemption_value)}</td><td className="px-3 py-3">{row.status}</td></tr>)}</tbody></table></div></div></div>

    {detail ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setDetail(null)}><aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}><button className="mb-4 text-sm text-slate-500" onClick={() => setDetail(null)}>Close</button><h3 className="text-xl font-semibold">Package Details</h3><pre className="mt-4 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{JSON.stringify(detail, null, 2)}</pre></aside></div> : null}
  </section>
}
