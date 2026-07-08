'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import BookingStatusBadge from './BookingStatusBadge'
import BookingPhotosPaymentProofSection from './BookingPhotosPaymentProofSection'
import BookingServicesAddOnsSection from './BookingServicesAddOnsSection'
import { type BookingServicePhoto } from './BookingServicePhotosPanel'
import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import { ReportDetailDrawer, ReportViewDetailsButton } from '@/components/reports/ReportActions'
import { type PaymentProof } from '@/components/payment/PaymentProofPreview'
import { formatDateTime12Hour } from '@/lib/formatDateTime'
import { getAppointmentDisplayRemarkLines } from '@/components/pos/posAppointmentHelpers'

export type { StaffSplit, BookingServiceAddOn, BookingServiceBlock } from './BookingServicesAddOnsSection'
import type { StaffSplit, BookingServiceAddOn, BookingServiceBlock } from './BookingServicesAddOnsSection'

type StaffOption = { id: number; name: string }

export type AppointmentHistoryRow = {
  id: number
  booking_code: string
  customer: { id: number; name: string; phone?: string | null; email?: string | null } | null
  customer_display_name: string
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  service: { id: number; name: string; cn_name?: string | null; duration_min?: number | null; amount?: number | null; staff_splits?: StaffSplit[] } | null
  services?: BookingServiceBlock[]
  service_blocks?: BookingServiceBlock[]
  add_ons?: BookingServiceAddOn[]
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
  total_amount_min?: number
  total_amount_max?: number
  amount_has_range?: boolean
  paid_amount: number
  paid_amount_min?: number
  paid_amount_max?: number
  paid_amount_has_range?: boolean
  deposit_paid: number
  settlement_paid: number
  package_offset: number
  package_offset_min?: number
  package_offset_max?: number
  package_offset_has_range?: boolean
  balance_due: number
  balance_due_min?: number
  balance_due_max?: number
  balance_has_range?: boolean
  is_range_priced?: boolean
  requires_settled_amount?: boolean
  settled_service_amount?: number | null
  service_total?: number
  addon_total_price?: number
  notes?: string | null
  void_remarks?: string | null
  settlement_notes?: string | null
  reschedule_reason?: string | null
  source?: string | null
  customer_reference_photos_count?: number
  customer_reference_photos?: Array<{ id: number; file_url?: string | null; original_name?: string | null }>
  service_photos_count?: number
  service_photos?: BookingServicePhoto[]
  payment_proofs?: PaymentProof[]
  logs?: Array<{ id: number; actor_type: string; actor_id?: number | null; action: string; meta?: unknown; created_at?: string | null }>
  package_claims?: Array<{ usage_id: number; customer_service_package_id: number; package_name: string; booking_service_id: number; status: string; used_qty: number }>
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

const STATUS_OPTIONS = ['HOLD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'LATE_CANCELLATION', 'NOTIFIED_CANCELLATION', 'EXPIRED', 'VOIDED']
const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
]

const formatDateTime = (value?: string | null) => formatDateTime12Hour(value) || '—'

const formatMoney = (value?: number | string | null) => `RM ${Number(value ?? 0).toFixed(2)}`

type HistoryMoneyField = 'total' | 'balance' | 'paid'

type HistoryMoneyDisplay =
  | { type: 'single'; text: string }
  | { type: 'range'; minText: string; maxText: string }

const resolveHistoryMoneyDisplay = (
  row: Pick<
    AppointmentHistoryRow,
    | 'total_amount'
    | 'total_amount_min'
    | 'total_amount_max'
    | 'amount_has_range'
    | 'balance_due'
    | 'balance_due_min'
    | 'balance_due_max'
    | 'balance_has_range'
    | 'paid_amount'
    | 'paid_amount_min'
    | 'paid_amount_max'
    | 'paid_amount_has_range'
    | 'deposit_paid'
    | 'settlement_paid'
    | 'package_offset'
    | 'package_offset_min'
    | 'package_offset_max'
    | 'package_offset_has_range'
  >,
  field: HistoryMoneyField,
): HistoryMoneyDisplay => {
  if (field === 'paid') {
    const paidMin = Number(row.paid_amount_min ?? row.paid_amount ?? 0)
    const paidMax = Number(row.paid_amount_max ?? row.paid_amount ?? 0)
    if (
      row.paid_amount_has_range &&
      Math.abs(paidMin - paidMax) > 0.0001
    ) {
      return {
        type: 'range',
        minText: `RM ${paidMin.toFixed(2)} -`,
        maxText: `RM ${paidMax.toFixed(2)}`,
      }
    }

    const deposit = Number(row.deposit_paid ?? 0)
    const settlement = Number(row.settlement_paid ?? 0)
    const pkgMin = Number(row.package_offset_min ?? row.package_offset ?? 0)
    const pkgMax = Number(row.package_offset_max ?? row.package_offset ?? 0)
    const coveredMin = deposit + settlement + pkgMin
    const coveredMax = deposit + settlement + pkgMax
    if (row.package_offset_has_range && Math.abs(pkgMin - pkgMax) > 0.0001) {
      return {
        type: 'range',
        minText: `RM ${coveredMin.toFixed(2)} -`,
        maxText: `RM ${coveredMax.toFixed(2)}`,
      }
    }

    return { type: 'single', text: formatMoney(coveredMin) }
  }
  if (
    field === 'total' &&
    row.amount_has_range &&
    row.total_amount_min != null &&
    row.total_amount_max != null &&
    Math.abs(Number(row.total_amount_min) - Number(row.total_amount_max)) > 0.0001
  ) {
    return {
      type: 'range',
      minText: `RM ${Number(row.total_amount_min).toFixed(2)} -`,
      maxText: `RM ${Number(row.total_amount_max).toFixed(2)}`,
    }
  }
  if (
    field === 'balance' &&
    row.balance_has_range &&
    row.balance_due_min != null &&
    row.balance_due_max != null &&
    Math.abs(Number(row.balance_due_min) - Number(row.balance_due_max)) > 0.0001
  ) {
    return {
      type: 'range',
      minText: `RM ${Number(row.balance_due_min).toFixed(2)} -`,
      maxText: `RM ${Number(row.balance_due_max).toFixed(2)}`,
    }
  }
  if (field === 'balance' && row.balance_due_min != null) {
    return {
      type: 'single',
      text: formatMoney(row.balance_due_min),
    }
  }
  return {
    type: 'single',
    text: formatMoney(field === 'total' ? row.total_amount : row.balance_due),
  }
}

const formatHistoryPackageCoveredDisplay = (
  row: Pick<
    AppointmentHistoryRow,
    'package_offset' | 'package_offset_min' | 'package_offset_max' | 'package_offset_has_range'
  >,
) => {
  if (
    row.package_offset_has_range &&
    row.package_offset_min != null &&
    row.package_offset_max != null &&
    Math.abs(Number(row.package_offset_min) - Number(row.package_offset_max)) > 0.0001
  ) {
    return `RM ${Number(row.package_offset_min).toFixed(2)} - RM ${Number(row.package_offset_max).toFixed(2)}`
  }

  return formatMoney(row.package_offset)
}

const formatHistoryMoneyDisplay = (
  row: Pick<
    AppointmentHistoryRow,
    | 'total_amount'
    | 'total_amount_min'
    | 'total_amount_max'
    | 'amount_has_range'
    | 'balance_due'
    | 'balance_due_min'
    | 'balance_due_max'
    | 'balance_has_range'
    | 'paid_amount'
    | 'paid_amount_min'
    | 'paid_amount_max'
    | 'paid_amount_has_range'
    | 'deposit_paid'
    | 'settlement_paid'
    | 'package_offset'
    | 'package_offset_min'
    | 'package_offset_max'
    | 'package_offset_has_range'
  >,
  field: HistoryMoneyField,
) => {
  const display = resolveHistoryMoneyDisplay(row, field)
  if (display.type === 'range') {
    return `${display.minText}\n${display.maxText}`
  }
  return display.text
}

function HistoryMoneyDisplayValue({
  row,
  field,
  className,
}: {
  row: AppointmentHistoryRow
  field: HistoryMoneyField
  className?: string
}) {
  const display = resolveHistoryMoneyDisplay(row, field)

  if (display.type === 'range') {
    return (
      <span className={`block text-xs leading-snug tabular-nums ${className ?? ''}`} title={formatHistoryMoneyDisplay(row, field)}>
        <span className="block">{display.minText}</span>
        <span className="block">{display.maxText}</span>
      </span>
    )
  }

  return (
    <span className={`block text-xs leading-snug tabular-nums ${className ?? ''}`} title={display.text}>
      {display.text}
    </span>
  )
}

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

const formatPaymentStatus = (status?: string | null) => {
  const s = String(status ?? '').toLowerCase()
  if (s === 'paid') return 'Paid'
  if (s === 'partial') return 'Partial'
  return 'Unpaid'
}

const formatAppointmentSlot = (start?: string | null, end?: string | null) => {
  if (!start) return '—'
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null
  const datePart = startDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
  const startTime = startDate.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })
  const endTime = endDate ? endDate.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }) : null
  return { datePart, timePart: endTime ? `${startTime} – ${endTime}` : startTime }
}

function TableCustomerCell({ row }: { row: AppointmentHistoryRow }) {
  const contact = row.customer?.phone ?? row.guest_phone ?? row.customer?.email ?? row.guest_email ?? null
  const name = row.customer_display_name || 'Walk-in / Unknown'

  return (
    <div className="min-w-0">
      <p className="line-clamp-2 font-medium leading-snug text-slate-900" title={name}>
        {name}
      </p>
      {contact ? (
        <p className="mt-0.5 truncate text-xs text-slate-500" title={contact}>
          {contact}
        </p>
      ) : null}
    </div>
  )
}

function TableServiceCell({ row }: { row: AppointmentHistoryRow }) {
  const serviceName = row.service?.name || '—'
  const addonCount = row.add_ons?.length ?? 0

  return (
    <div className="min-w-0">
      <p className="line-clamp-2 font-medium leading-snug text-slate-900" title={row.service?.name ?? undefined}>
        {serviceName}
      </p>
      {row.service?.cn_name ? (
        <p className="mt-0.5 truncate text-xs text-slate-500" title={row.service.cn_name}>
          {row.service.cn_name}
        </p>
      ) : null}
      {addonCount > 0 ? (
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          +{addonCount} add-on{addonCount === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  )
}

function TableMoneyCell({
  row,
  field,
  className,
}: {
  row: AppointmentHistoryRow
  field: HistoryMoneyField
  className?: string
}) {
  return <HistoryMoneyDisplayValue row={row} field={field} className={className} />
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


export function BookingAppointmentDetailDrawer({
  row,
  loading,
  error,
  onClose,
  onServicePhotosChanged,
}: {
  row: AppointmentHistoryRow | null
  loading: boolean
  error: string | null
  onClose: () => void
  onServicePhotosChanged?: (photos: BookingServicePhoto[]) => void
}) {
  const [servicePhotos, setServicePhotos] = useState<BookingServicePhoto[]>([])

  useEffect(() => {
    setServicePhotos(row?.service_photos ?? [])
  }, [row])

  const handleServicePhotosChanged = (photos: BookingServicePhoto[]) => {
    setServicePhotos(photos)
    onServicePhotosChanged?.(photos)
  }

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
                {(() => {
                  const remarkLines = getAppointmentDisplayRemarkLines(row)
                  if (remarkLines.length === 0) return null
                  return (
                    <div className="mt-4 space-y-1">
                      {remarkLines.map((line) => (
                        <p key={`appointment-remark-${line.key}`} className="text-xs font-medium text-slate-600">
                          <span className="text-slate-500">{line.label}:</span>{' '}
                          <span className="whitespace-pre-wrap">{line.value}</span>
                        </p>
                      ))}
                    </div>
                  )
                })()}
              </section>

              <BookingServicesAddOnsSection row={row} />

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Payment Breakdown</h4>
                <dl className="mt-4 grid gap-4 md:grid-cols-2">
                  <DetailField label="Total Amount" value={<HistoryMoneyDisplayValue row={row} field="total" className="text-sm" />} />
                  <DetailField label="Deposit Paid" value={formatMoney(row.deposit_paid)} />
                  <DetailField label="Settlement Paid" value={formatMoney(row.settlement_paid)} valueClassName="tabular-nums text-emerald-700" />
                  <DetailField label="Package Covered" value={formatHistoryPackageCoveredDisplay(row)} valueClassName="tabular-nums text-emerald-700" />
                  {/* <DetailField label="Total Covered" value={<HistoryMoneyDisplayValue row={row} field="paid" className={paidAmountClass(row.paid_amount)} />} labelClassName="text-emerald-700" valueClassName={paidAmountClass(row.paid_amount)} /> */}
                  <DetailField label="Balance Due" value={<HistoryMoneyDisplayValue row={row} field="balance" className={`text-sm ${balanceDueClass(row.balance_due)}`} />} labelClassName="text-amber-700" valueClassName={balanceDueClass(row.balance_due)} />
                </dl>
              </section>

              <BookingPhotosPaymentProofSection
                bookingId={row.id}
                bookingCode={row.booking_code}
                customerReferencePhotos={row.customer_reference_photos}
                servicePhotos={servicePhotos}
                paymentProofs={row.payment_proofs}
                canManageServicePhotos={row.status === 'COMPLETED'}
                onServicePhotosChanged={handleServicePhotosChanged}
              />

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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 px-3 py-3 whitespace-nowrap shadow-[1px_0_0_0_rgb(226_232_240)]">Booking No</th>
              <th className="min-w-[10rem] px-3 py-3">Customer</th>
              <th className="min-w-[10rem] px-3 py-3">Service</th>
              <th className="min-w-[8.5rem] px-3 py-3 whitespace-nowrap">Appointment</th>
              <th className="px-3 py-3 whitespace-nowrap">Status</th>
              <th className="px-3 py-3 whitespace-nowrap">Payment</th>
              <th className="min-w-[6.5rem] px-3 py-3 text-right whitespace-nowrap">Total</th>
              <th className="min-w-[6rem] px-3 py-3 text-right whitespace-nowrap text-emerald-700">Paid</th>
              <th className="min-w-[6rem] px-3 py-3 text-right whitespace-nowrap text-amber-700">Balance</th>
              <th className="px-3 py-3 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableLoadingRow colSpan={10} />
            ) : rows.length > 0 ? rows.map((row) => {
              const appointmentSlot = formatAppointmentSlot(row.start_at, row.end_at)

              return (
              <tr key={row.id} className="group hover:bg-slate-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top whitespace-nowrap shadow-[1px_0_0_0_rgb(241_245_249)] group-hover:bg-slate-50">
                  <span className="font-mono text-xs font-semibold text-slate-900">{row.booking_code}</span>
                </td>
                <td className="min-w-[10rem] max-w-[13rem] overflow-hidden px-3 py-3 align-top">
                  <TableCustomerCell row={row} />
                </td>
                <td className="min-w-[10rem] max-w-[13rem] overflow-hidden px-3 py-3 align-top">
                  <TableServiceCell row={row} />
                </td>
                <td className="min-w-[8.5rem] max-w-[10rem] px-3 py-3 align-top text-xs tabular-nums">
                  {typeof appointmentSlot === 'string' ? (
                    appointmentSlot
                  ) : (
                    <div className="min-w-0 leading-snug">
                      <p className="text-slate-900">{appointmentSlot.datePart}</p>
                      <p className="mt-0.5 text-slate-500">{appointmentSlot.timePart}</p>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <BookingStatusBadge status={row.status} label={row.status} />
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${paymentBadgeClass(resolvedPaymentStatus(row))}`}>
                    {formatPaymentStatus(resolvedPaymentStatus(row))}
                  </span>
                </td>
                <td className="min-w-[6.5rem] px-3 py-3 text-right align-top tabular-nums">
                  <TableMoneyCell row={row} field="total" />
                </td>
                <td className={`min-w-[6rem] px-3 py-3 text-right align-top tabular-nums ${paidAmountClass(row.paid_amount)}`}>
                  <TableMoneyCell row={row} field="paid" className={paidAmountClass(row.paid_amount)} />
                </td>
                <td className={`min-w-[6rem] px-3 py-3 text-right align-top tabular-nums ${balanceDueClass(row.balance_due)}`}>
                  <TableMoneyCell row={row} field="balance" className={balanceDueClass(row.balance_due)} />
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <ReportViewDetailsButton onClick={() => { setDetail(row); setDetailId(row.id) }} title={`View details for ${row.booking_code}`} />
                </td>
              </tr>
            )}) : (
              <TableEmptyState colSpan={10} />
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Total records: {totalRows}</p>
        <PaginationControls currentPage={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} disabled={loading} />
      </div>

      <BookingAppointmentDetailDrawer
        row={detail}
        loading={detailLoading}
        error={detailError}
        onClose={() => { setDetailId(null); setDetail(null); setDetailError(null) }}
        onServicePhotosChanged={(photos) => {
          setDetail((current) => (current ? { ...current, service_photos: photos, service_photos_count: photos.length } : current))
        }}
      />
    </div>
  )
}
