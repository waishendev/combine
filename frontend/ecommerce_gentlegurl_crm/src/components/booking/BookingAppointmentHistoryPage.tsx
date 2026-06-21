'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import BookingStatusBadge from './BookingStatusBadge'
import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import { ReportDetailDrawer, ReportViewDetailsButton } from '@/components/reports/ReportActions'

type StaffOption = { id: number; name: string }
type StaffSplit = { staff_id: number; staff_name?: string | null; name?: string | null; share_percent: number }

type AppointmentHistoryRow = {
  id: number
  booking_code: string
  customer: { id: number; name: string; phone?: string | null; email?: string | null } | null
  customer_display_name: string
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  service: { id: number; name: string; cn_name?: string | null; duration_min?: number | null; amount?: number | null; staff_splits?: StaffSplit[] } | null
  add_ons?: Array<{ id?: number | null; name: string; cn_name?: string | null; extra_duration_min: number; extra_price: number; staff_splits?: StaffSplit[]; staff_split_source?: 'explicit' | 'inherited' | string; service_ref?: string | null; item_kind?: string | null; line_type?: string | null; parent_service_ref?: string | null }>
  staff: { id: number; name: string } | null
  start_at?: string | null
  end_at?: string | null
  created_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  status: string
  payment_status: 'paid' | 'partial' | 'unpaid' | string
  booking_payment_status?: string
  computed_payment_status?: 'paid' | 'partial' | 'unpaid' | string
  total_amount: number
  paid_amount: number
  deposit_paid: number
  settlement_paid: number
  package_offset: number
  balance_due: number
  notes?: string | null
  source?: string | null
  logs?: Array<{ id: number; actor_type: string; actor_id?: number | null; action: string; meta?: unknown; created_at?: string | null }>
}

type ApiPage = {
  data?: {
    data?: AppointmentHistoryRow[]
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
  message?: string
}

type Filters = {
  fromDate: string
  toDate: string
  status: string
  paymentStatus: string
  staffId: string
  q: string
}

const emptyFilters: Filters = {
  fromDate: '',
  toDate: '',
  status: '',
  paymentStatus: '',
  staffId: '',
  q: '',
}

const STATUS_OPTIONS = ['HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION', 'EXPIRED']
const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const formatMoney = (value?: number | string | null) => `RM ${Number(value ?? 0).toFixed(2)}`

const paidAmountClass = (value?: number | string | null) => {
  const amount = Number(value ?? 0)
  if (amount <= 0) return 'text-slate-500'
  return 'font-semibold text-emerald-700'
}

const balanceDueClass = (value?: number | string | null) => {
  const amount = Number(value ?? 0)
  if (amount <= 0) return 'font-medium text-slate-500'
  return 'font-bold text-amber-700'
}

const paymentBadgeClass = (status?: string | null) => {
  switch (String(status ?? '').toLowerCase()) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
    case 'partial':
      return 'bg-blue-100 text-blue-800 ring-blue-200'
    default:
      return 'bg-amber-100 text-amber-800 ring-amber-200'
  }
}

const resolvedPaymentStatus = (row: Pick<AppointmentHistoryRow, 'payment_status' | 'computed_payment_status'>) => row.payment_status ?? row.computed_payment_status

const visibleAddOns = (row: Pick<AppointmentHistoryRow, 'add_ons'>) => (row.add_ons ?? []).filter((item) => {
  const itemKind = String(item.item_kind ?? item.line_type ?? 'addon').toLowerCase()
  const serviceRef = String(item.service_ref ?? '').toLowerCase()
  return itemKind !== 'main_service' && serviceRef !== 'original'
})

const formatPaymentStatus = (status?: string | null) => {
  const s = String(status ?? '').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial') return 'Partial'
  return 'Unpaid'
}

function DetailField({
  label,
  value,
  labelClassName,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  labelClassName?: string
  valueClassName?: string
}) {
  return (
    <div>
      <dt className={`text-xs font-semibold uppercase tracking-wide ${labelClassName ?? 'text-slate-500'}`}>{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${valueClassName ?? 'text-slate-900'}`}>{value}</dd>
    </div>
  )
}


function StaffSplitList({ splits, inherited }: { splits?: StaffSplit[]; inherited?: boolean }) {
  if (!splits?.length) return <p className="text-sm text-slate-500">—</p>

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff Split:</p>
      <ul className="space-y-1 text-sm text-slate-700">
        {splits.map((split, index) => (
          <li key={`${split.staff_id}-${index}`}>
            <span>{split.staff_name ?? split.name ?? `Staff #${split.staff_id}`} — {Number(split.share_percent ?? 0)}%</span>
            {inherited && index === 0 ? <span className="ml-2 text-xs text-slate-500">Inherited from main service</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DetailDrawer({ row, loading, error, onClose }: { row: AppointmentHistoryRow | null; loading: boolean; error: string | null; onClose: () => void }) {
  if (!row && !loading && !error) return null

  return (
    <ReportDetailDrawer
      open={Boolean(row || loading || error)}
      title={row?.booking_code ?? 'Loading…'}
      subtitle="Appointment History"
      onClose={onClose}
      loading={loading}
      loadingText="Loading appointment detail…"
      error={error}
      maxWidthClassName="max-w-3xl"
    >
      {row ? (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Booking Info</h4>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <DetailField label="Booking No" value={row.booking_code} />
                  <DetailField label="Source" value={row.source ?? '—'} />
                  <DetailField label="Status" value={<BookingStatusBadge status={row.status} label={row.status} />} />
                  <DetailField label="Payment Status" value={<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${paymentBadgeClass(resolvedPaymentStatus(row))}`}>{formatPaymentStatus(resolvedPaymentStatus(row))}</span>} />
                  <DetailField label="Created At" value={formatDateTime(row.created_at)} />
                  <DetailField label="Completed / Cancelled" value={row.completed_at ? formatDateTime(row.completed_at) : formatDateTime(row.cancelled_at)} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Customer / Guest</h4>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <DetailField label="Name" value={row.customer_display_name || 'Walk-in / Unknown'} />
                  <DetailField label="Phone" value={row.customer?.phone ?? row.guest_phone ?? '—'} />
                  <DetailField label="Email" value={row.customer?.email ?? row.guest_email ?? '—'} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Services + Add-ons</h4>
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900">Main Service</p>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{row.service?.name ?? '—'}</p>
                        {row.service?.cn_name ? <p className="text-xs text-slate-500">{row.service.cn_name}</p> : null}
                      </div>
                      <p className="text-sm text-slate-700">Amount: {formatMoney(row.service?.amount ?? Math.max(0, Number(row.total_amount ?? 0) - visibleAddOns(row).reduce((sum, item) => sum + Number(item.extra_price ?? 0), 0)))}</p>
                      <p className="text-sm text-slate-700">Schedule: {`${formatDateTime(row.start_at)} - ${formatDateTime(row.end_at)}`}</p>
                      <StaffSplitList splits={row.service?.staff_splits ?? (row.staff ? [{ staff_id: row.staff.id, staff_name: row.staff.name, share_percent: 100 }] : [])} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add-ons</p>
                    {visibleAddOns(row).length > 0 ? (
                      <div className="mt-2 space-y-3">
                        {visibleAddOns(row).map((item, index) => (
                          <div key={`${item.id ?? item.name}-${index}`} className="rounded-lg border border-slate-200 p-3">
                            <p className="text-sm font-semibold text-slate-900">{index + 1}. {item.name}</p>
                            {item.cn_name ? <p className="text-xs text-slate-500">{item.cn_name}</p> : null}
                            <p className="mt-2 text-sm text-slate-700">Amount: {formatMoney(item.extra_price)}</p>
                            <div className="mt-2"><StaffSplitList splits={item.staff_splits} inherited={item.staff_split_source === 'inherited'} /></div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-2 text-sm text-slate-500">—</p>}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Payment Breakdown</h4>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <DetailField label="Total Amount" value={formatMoney(row.total_amount)} />
                  <DetailField label="Deposit" value={formatMoney(row.deposit_paid)} />
                  <DetailField label="Settlement Paid" value={formatMoney(row.settlement_paid)} />
                  <DetailField label="Package Offset" value={formatMoney(row.package_offset)} />
                  <DetailField label="Paid Amount" value={formatMoney(row.paid_amount)} labelClassName="text-emerald-700" valueClassName={paidAmountClass(row.paid_amount)} />
                  <DetailField label="Balance Due" value={formatMoney(row.balance_due)} labelClassName="text-amber-700" valueClassName={balanceDueClass(row.balance_due)} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Status Logs</h4>
                {(row.logs ?? []).length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {row.logs?.map((log) => (
                      <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{log.action}</span>
                          <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{log.actor_type}{log.actor_id ? ` #${log.actor_id}` : ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No status logs available.</p>
                )}
              </section>
            </div>
      ) : null}
    </ReportDetailDrawer>
  )
}

export default function BookingAppointmentHistoryPage() {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...emptyFilters })
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [rows, setRows] = useState<AppointmentHistoryRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AppointmentHistoryRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const loadStaffs = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      const json = await res.json().catch(() => null) as { data?: StaffOption[] | { data?: StaffOption[] } } | null
      const data = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.data) ? json.data.data : []
      setStaffs(data)
    } catch {
      setStaffs([])
    }
  }, [])

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('per_page', String(pageSize))
      if (appliedFilters.fromDate) qs.set('from_date', appliedFilters.fromDate)
      if (appliedFilters.toDate) qs.set('to_date', appliedFilters.toDate)
      if (appliedFilters.status) qs.set('status', appliedFilters.status)
      if (appliedFilters.paymentStatus) qs.set('payment_status', appliedFilters.paymentStatus)
      if (appliedFilters.staffId) qs.set('staff_id', appliedFilters.staffId)
      if (appliedFilters.q.trim()) qs.set('q', appliedFilters.q.trim())

      const res = await fetch(`/api/proxy/admin/booking/appointment-history?${qs.toString()}`, { cache: 'no-store', signal })
      const json = await res.json().catch(() => null) as ApiPage | null
      if (!res.ok) {
        setRows([])
        setError(json?.message ?? 'Failed to load appointment history.')
        return
      }
      setRows(Array.isArray(json?.data?.data) ? json.data.data : [])
      setTotalPages(Number(json?.data?.last_page ?? 1) || 1)
      setTotalRows(Number(json?.data?.total ?? 0) || 0)
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setRows([])
        setError('Failed to load appointment history.')
      }
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, page, pageSize])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/proxy/admin/booking/appointment-history/${id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null) as { data?: AppointmentHistoryRow; message?: string } | null
      if (!res.ok) {
        setDetail(null)
        setDetailError(json?.message ?? 'Failed to load appointment detail.')
        return
      }
      setDetail(json?.data ?? null)
    } catch {
      setDetail(null)
      setDetailError('Failed to load appointment detail.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStaffs()
  }, [loadStaffs])

  useEffect(() => {
    const controller = new AbortController()
    void fetchRows(controller.signal)
    return () => controller.abort()
  }, [fetchRows])

  useEffect(() => {
    if (detailId) void loadDetail(detailId)
  }, [detailId, loadDetail])

  const activeFilterCount = useMemo(() => Object.values(appliedFilters).filter(Boolean).length, [appliedFilters])

  const applyFilters = () => {
    setAppliedFilters(filters)
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({ ...emptyFilters })
    setAppliedFilters({ ...emptyFilters })
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Created from</span>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Created to</span>
            <input type="date" value={filters.toDate} onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Payment</span>
            <select value={filters.paymentStatus} onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">All payments</option>
              {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Staff</span>
            <select value={filters.staffId} onChange={(e) => setFilters((prev) => ({ ...prev, staffId: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2">
              <option value="">All staff</option>
              {staffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <input type="search" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Booking no / customer" className="w-full rounded border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{activeFilterCount > 0 ? `${activeFilterCount} filter(s) applied` : 'Showing newest created appointment records'}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetFilters} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
            <button type="button" onClick={applyFilters} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Apply filters</button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded border border-slate-300 px-2 py-2 text-sm">
              {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-3">Booking No</th>
              <th className="px-3 py-3">Customer / Guest / Walk-in</th>
              <th className="px-3 py-3">Service</th>
              <th className="px-3 py-3">Staff</th>
              <th className="px-3 py-3">Appointment Date & Time</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Payment Status</th>
              <th className="px-3 py-3 text-right">Total Amount</th>
              <th className="px-3 py-3 text-right text-emerald-700">Paid Amount</th>
              <th className="px-3 py-3 text-right text-amber-700">Balance Due</th>
              <th className="px-3 py-3">Created At</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableLoadingRow colSpan={12} />
            ) : rows.length > 0 ? rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold text-slate-900">{row.booking_code}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-900">{row.customer_display_name || 'Walk-in / Unknown'}</div>
                  <div className="text-xs text-slate-500">{row.customer?.phone ?? row.guest_phone ?? row.customer?.email ?? row.guest_email ?? '—'}</div>
                </td>
                <td className="px-3 py-3">{row.service?.name ?? '—'}</td>
                <td className="px-3 py-3">{row.staff?.name ?? '—'}</td>
                <td className="px-3 py-3 text-xs tabular-nums">{formatDateTime(row.start_at)}<br /><span className="text-slate-500">to {formatDateTime(row.end_at)}</span></td>
                <td className="px-3 py-3"><BookingStatusBadge status={row.status} label={row.status} /></td>
                <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${paymentBadgeClass(resolvedPaymentStatus(row))}`}>{formatPaymentStatus(resolvedPaymentStatus(row))}</span></td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(row.total_amount)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${paidAmountClass(row.paid_amount)}`}>{formatMoney(row.paid_amount)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${balanceDueClass(row.balance_due)}`}>{formatMoney(row.balance_due)}</td>
                <td className="px-3 py-3 text-xs tabular-nums">{formatDateTime(row.created_at)}</td>
                <td className="px-3 py-3">
                  <ReportViewDetailsButton onClick={() => { setDetail(row); setDetailId(row.id) }} title={`View details for ${row.booking_code}`} />
                </td>
              </tr>
            )) : (
              <TableEmptyState colSpan={12} />
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Total records: {totalRows}</p>
        <PaginationControls currentPage={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} disabled={loading} />
      </div>

      <DetailDrawer row={detail} loading={detailLoading} error={detailError} onClose={() => { setDetailId(null); setDetail(null); setDetailError(null) }} />
    </div>
  )
}
