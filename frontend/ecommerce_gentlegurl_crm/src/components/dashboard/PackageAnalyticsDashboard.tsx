'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ReportDetailDrawer, ReportViewDetailsButton } from '@/components/reports/ReportActions'
import { apiFetch } from '@/lib/api'

const PER_PAGE = 10

type Summary = {
  templates: { total: number; active: number; inactive: number; missing_redemption_value_count: number }
  customers: { active_holders: number; active_customer_packages: number }
  balances: { remaining_redemptions: number; outstanding_service_value: number }
  sales: { gross_package_sales: number; refund_amount: number; net_package_sales: number }
  redemptions: { redeemed_qty: number; redeemed_value: number }
  status: { expiring_soon: number; exhausted: number; expired: number; cancelled: number }
}

type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }

type Liability = {
  id: number
  customer: string
  package: string
  purchased_from: string
  purchase_date: string
  started_at: string | null
  expires_at: string | null
  status: string
  total_qty: number
  used_qty: number
  remaining_qty: number
  purchase_amount: number
  remaining_service_value: number
  missing_values: number
}

type PackageDetailInfo = {
  id: number
  customer: string
  package: string
  purchased_from: string
  purchase_date: string
  started_at: string | null
  expires_at: string | null
  status: string
  purchase_amount: number
}

type PackageBalance = {
  id: number
  service_name: string
  total_qty: number
  used_qty: number
  remaining_qty: number
  redemption_value_per_use: number
  used_value: number
  remaining_value: number
  missing_value: number
}

type PackageUsage = {
  id: number
  usage_date: string
  booking_no: string | number | null
  service_name: string
  used_qty: number
  redemption_value: number
  total_value: number
  missing_value: number
  staff: number | null
  source: string
  status: string
  notes?: string | null
}

type Detail = {
  package: PackageDetailInfo
  balances: PackageBalance[]
  usages: PackageUsage[]
}

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value ?? 0))

const dateText = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-MY') : '—')

function formatPackageSource(source?: string | null) {
  const normalized = source?.trim().toUpperCase()
  if (normalized === 'POS') return 'OFFLINE'
  if (normalized === 'BOOKING') return 'ONLINE'
  return source?.trim() || '—'
}

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

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className = {
    active: 'bg-emerald-100 text-emerald-800',
    exhausted: 'bg-slate-200 text-slate-700',
    expired: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-rose-100 text-rose-800',
  }[normalized] ?? 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${className}`}>
      {status}
    </span>
  )
}

function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) return false
  const expiry = new Date(expiresAt)
  const now = new Date()
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + 30)
  return expiry >= now && expiry <= threshold
}

function PackageLiabilityDrawer({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: Detail | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  const pkg = detail?.package

  return (
    <ReportDetailDrawer
      open
      maxWidthClassName="max-w-4xl"
      title={pkg?.package ?? 'Package Details'}
      subtitle={pkg ? <p className="text-sm text-slate-600">{pkg.customer}</p> : undefined}
      onClose={onClose}
      loading={loading}
      loadingText="Loading package details…"
      error={error}
      empty={!loading && !error && !detail ? 'No package details found.' : undefined}
    >
      {detail && pkg ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DrawerMetricCard label="Purchase Amount" value={money(pkg.purchase_amount)} accent="indigo" />
            <DrawerMetricCard
              label="Remaining Value"
              value={money(detail.balances.reduce((sum, row) => sum + Number(row.remaining_value ?? 0), 0))}
              accent="emerald"
            />
            <DrawerMetricCard
              label="Sessions Left"
              value={String(detail.balances.reduce((sum, row) => sum + Number(row.remaining_qty ?? 0), 0))}
              note={`${detail.balances.reduce((sum, row) => sum + Number(row.used_qty ?? 0), 0)} used`}
              accent="slate"
            />
            <DrawerMetricCard label="Status" value={pkg.status} accent={pkg.status === 'active' ? 'emerald' : 'amber'} />
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Package Information</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Customer" value={pkg.customer} />
              <DetailField label="Source" value={formatPackageSource(pkg.purchased_from)} />
              <DetailField label="Purchase Date" value={dateText(pkg.purchase_date)} />
              <DetailField label="Started At" value={dateText(pkg.started_at)} />
              <DetailField label="Expires At" value={pkg.expires_at ? dateText(pkg.expires_at) : 'No expiry'} />
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Service Balances</h4>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Used</th>
                      <th className="px-4 py-3 text-right">Remaining</th>
                      <th className="px-4 py-3 text-right">Value / Use</th>
                      <th className="px-4 py-3 text-right">Remaining Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.balances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                          No service balances found.
                        </td>
                      </tr>
                    ) : (
                      detail.balances.map((row) => (
                        <tr key={row.id} className="hover:bg-indigo-50/30">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {row.service_name || '—'}
                            {row.missing_value ? (
                              <span className="ml-2 text-xs font-medium text-amber-700">Missing value</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.total_qty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.used_qty}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700">{row.remaining_qty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{money(row.redemption_value_per_use)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{money(row.remaining_value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Redemption History</h4>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Booking</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.usages.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                          No redemption activity yet.
                        </td>
                      </tr>
                    ) : (
                      detail.usages.map((row) => (
                        <tr key={row.id} className="hover:bg-indigo-50/30">
                          <td className="px-4 py-3 text-slate-700">{dateText(row.usage_date)}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.service_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-600">{row.booking_no ? String(row.booking_no) : '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.used_qty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{money(row.total_value)}</td>
                          <td className="px-4 py-3 text-slate-600">{row.source || '—'}</td>
                          <td className="px-4 py-3 capitalize text-slate-600">{row.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </ReportDetailDrawer>
  )
}

type FilterOption = {
  id: number
  name: string
}

type FilterOptionsResponse = {
  customers: FilterOption[]
  packages: FilterOption[]
}

type PackageAnalyticsDashboardProps = {
  onInitialLoad?: () => void
}

export default function PackageAnalyticsDashboard({ onInitialLoad }: PackageAnalyticsDashboardProps = {}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [liability, setLiability] = useState<Page<Liability> | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptionsResponse>({ customers: [], packages: [] })
  const [error, setError] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)
  const [liabilityLoading, setLiabilityLoading] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [packageId, setPackageId] = useState('')
  const [status, setStatus] = useState('')
  const [liabilityPage, setLiabilityPage] = useState(1)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiFetch<Summary>('/api/admin/dashboard/analytics/packages/summary'),
      apiFetch<FilterOptionsResponse>('/api/admin/dashboard/analytics/packages/filter-options'),
    ])
      .then(([summaryData, optionsData]) => {
        if (!cancelled) {
          setSummary(summaryData)
          setFilterOptions(optionsData)
          setError(null)
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load package analytics'))
      .finally(() => !cancelled && setSummaryLoading(false))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLiabilityLoading(true)
    const q = new URLSearchParams({ page: String(liabilityPage), per_page: String(PER_PAGE) })
    if (customerId) q.set('customer_id', customerId)
    if (packageId) q.set('service_package_id', packageId)
    if (status) q.set('status', status)

    apiFetch<Page<Liability>>(`/api/admin/dashboard/analytics/packages/customer-packages?${q}`)
      .then((liabilityData) => {
        if (!cancelled) {
          setLiability(liabilityData)
          setError(null)
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load package liability'))
      .finally(() => !cancelled && setLiabilityLoading(false))

    return () => {
      cancelled = true
    }
  }, [customerId, liabilityPage, packageId, status])

  useEffect(() => {
    if (!hasInitiallyLoaded && !summaryLoading && !liabilityLoading) {
      setHasInitiallyLoaded(true)
      onInitialLoad?.()
    }
  }, [hasInitiallyLoaded, liabilityLoading, onInitialLoad, summaryLoading])

  const resetFilters = () => {
    setCustomerId('')
    setPackageId('')
    setStatus('')
    setLiabilityPage(1)
  }

  const openDetail = async (id: number) => {
    setDetailOpen(true)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const response = await apiFetch<Detail>(`/api/admin/dashboard/analytics/packages/customer-packages/${id}`)
      setDetail(response)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unable to load details')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setDetailError(null)
  }

  if (!hasInitiallyLoaded) {
    if (error && !summary) {
      return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
    }
    return null
  }

  if (error && !summary) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
  if (!summary) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Unable to load package analytics.</p>

  const totalRows = liability?.total ?? 0
  const lastPage = liability?.last_page ?? 1
  const currentPage = liability?.current_page ?? liabilityPage
  const startItem = totalRows === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1
  const endItem = Math.min(currentPage * PER_PAGE, totalRows)
  const hasActiveFilters = Boolean(customerId || packageId || status)

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Analytics</p>
          <h2 className="text-2xl font-semibold text-slate-950">Package Analytics</h2>
          <p className="text-sm text-slate-600">Purchase revenue is reported separately from internal redemption value owed to customers.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Service Packages" value={String(summary.templates.total)} note={`${summary.templates.active} active · ${summary.templates.inactive} inactive`} />
          <MetricCard label="Customers with Active Packages" value={String(summary.customers.active_holders)} />
          <MetricCard label="Package Sales Revenue" value={money(summary.sales.net_package_sales)} />
          <MetricCard label="Remaining Redemptions" value={String(summary.balances.remaining_redemptions)} note="Sessions  available" />
          <MetricCard label="Outstanding Package Claim Value" value={money(summary.balances.outstanding_service_value)} note="Unused balance value" />
          <MetricCard label="Redeemed Package Value" value={money(summary.redemptions.redeemed_value)}/>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Customer Package Liability</h3>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[180px] text-sm font-medium text-slate-700">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Customer</span>
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  setLiabilityPage(1)
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All customers</option>
                {filterOptions.customers.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[180px] text-sm font-medium text-slate-700">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Package</span>
              <select
                value={packageId}
                onChange={(e) => {
                  setPackageId(e.target.value)
                  setLiabilityPage(1)
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All packages</option>
                {filterOptions.packages.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[160px] text-sm font-medium text-slate-700">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setLiabilityPage(1)
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Package</th>
                  <th className="px-4 py-3.5">Source</th>
                  <th className="px-4 py-3.5">Purchased</th>
                  <th className="px-4 py-3.5">Expires</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Sessions</th>
                  <th className="px-4 py-3.5 text-right">Purchase Amount</th>
                  <th className="px-4 py-3.5 text-right">Remaining Value</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liabilityLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                      <i className="fa-solid fa-spinner fa-spin mr-2 text-slate-400" aria-hidden="true" />
                      Loading package liability…
                    </td>
                  </tr>
                ) : !liability?.data.length ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-slate-500">
                        <i className="fa-solid fa-box-open text-2xl text-slate-300" aria-hidden="true" />
                        <p className="text-sm font-medium text-slate-700">No package liability rows found</p>
                        <p className="text-xs">Try adjusting your customer, package, or status filter.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  liability.data.map((row) => (
                    <tr key={row.id} className="transition hover:bg-indigo-50/40">
                      <td className="px-4 py-3.5 font-medium text-slate-900">{row.customer}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{row.package}</p>
                        {row.missing_values > 0 ? (
                          <p className="mt-0.5 text-xs font-medium text-amber-700">Missing redemption value</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{formatPackageSource(row.purchased_from)}</td>
                      <td className="px-4 py-3.5 text-slate-600">{dateText(row.purchase_date)}</td>
                      <td className="px-4 py-3.5">
                        <p className="text-slate-600">{row.expires_at ? dateText(row.expires_at) : 'No expiry'}</p>
                        {isExpiringSoon(row.expires_at) ? (
                          <p className="mt-0.5 text-xs font-medium text-amber-700">Expiring soon</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className="font-medium text-slate-900">{row.remaining_qty}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-slate-600">{row.total_qty}</span>
                        <p className="mt-0.5 text-xs text-slate-500">{row.used_qty} used</p>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{money(row.purchase_amount)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium text-emerald-700">{money(row.remaining_service_value)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <ReportViewDetailsButton onClick={() => void openDetail(row.id)} title={`View details for ${row.package}`} />
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
                disabled={liabilityPage <= 1 || liabilityLoading}
                onClick={() => setLiabilityPage((current) => Math.max(1, current - 1))}
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
                disabled={liabilityPage >= lastPage || liabilityLoading}
                onClick={() => setLiabilityPage((current) => Math.min(lastPage, current + 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailOpen ? (
        <PackageLiabilityDrawer detail={detail} loading={detailLoading} error={detailError} onClose={closeDetail} />
      ) : null}
    </section>
  )
}
