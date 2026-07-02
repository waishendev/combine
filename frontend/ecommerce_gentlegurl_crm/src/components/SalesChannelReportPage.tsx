'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import CrmFilterModalShell from '@/components/CrmFilterModalShell'
import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import OfflineOrderActions from './reports/OfflineOrderActions'
import OrderReceiptAction from './reports/OrderReceiptAction'
import { ReportDetailDrawer, ReportViewDetailsButton } from './reports/ReportActions'
import BookingServicePhotosPanel from './booking/BookingServicePhotosPanel'
import PaymentProofPreview, { type PaymentProof } from './payment/PaymentProofPreview'
import { getAppointmentDisplayRemarkLines } from '@/components/pos/posAppointmentHelpers'

type Mode = 'ecommerce' | 'booking'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type PaymentBreakdownRow = { method?: string | null; payment_method?: string | null; amount?: number | string | null; reference_no?: string | null }

type EcommerceRow = {
  order_id: number
  order_no: string
  transaction_no?: string | null
  order_datetime: string
  customer: string
  channel: string
  payment_method: string
  payments?: PaymentBreakdownRow[]
  order_total?: number
  item_count: number
  product_amount: number
  discount: number
  net_amount: number
  status: string
}

type BookingRow = {
  order_id: number
  order_no: string
  transaction_no?: string | null
  order_datetime: string
  customer: string
  channel: string
  payment_method: string
  payments?: PaymentBreakdownRow[]
  order_total?: number
  type: string
  booking_id?: number | null
  booking_no: string | null
  package_name: string | null
  package_cn_name?: string | null
  gross_amount: number
  discount: number
  net_amount: number
  status: string
}

type EcommerceResponse = {
  summary?: {
    total_sales?: number
    online_sales?: number
    offline_sales?: number
    total_orders?: number
  }
  rows?: EcommerceRow[]
  totals_page?: {
    orders_count?: number
    product_amount?: number
    discount?: number
    net_amount?: number
  }
  grand_totals?: {
    orders_count?: number
    product_amount?: number
    discount?: number
    net_amount?: number
  }
  pagination?: Partial<Pagination>
}

type BookingResponse = {
  summary?: {
    total_booking_revenue?: number
    online_booking_revenue?: number
    offline_booking_revenue?: number
    total_transactions?: number
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
    booking_product_amount?: number
  }
  rows?: BookingRow[]
  totals_page?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
    booking_product_amount?: number
  }
  grand_totals?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
    booking_product_amount?: number
  }
  pagination?: Partial<Pagination>
}

type OrderDetailLine = {
  id: number | string
  line_type: string
  type_label: string
  booking_no?: string | null
  name: string
  cn_name?: string | null
  variant_name?: string | null
  variant_cn_name?: string | null
  sku?: string | null
  qty: number
  unit_price: number
  line_total?: number
  original_line_total?: number | string | null
  final_line_total?: number | string | null
  gross_amount: number
  discount_amount: number
  net_amount: number
  discount_type?: 'percentage' | 'fixed' | string | null
  discount_value?: number
  discount_remark?: string | null
  staff_name?: string | null
  assigned_staff_name?: string | null
  price_override?: {
    original_unit_price?: number | string | null
    original_unit_price_snapshot?: number | string | null
    final_unit_price?: number | string | null
    unit_price_snapshot?: number | string | null
    original_line_total?: number | string | null
    adjusted_line_total?: number | string | null
    final_line_total?: number | string | null
    price_override_reason?: string | null
    price_overridden_by?: number | string | null
    price_overridden_by_label?: string | null
    price_override_mode?: string | null
    price_overridden_at?: string | null
  } | null
  original_unit_price?: number | string | null
  final_unit_price?: number | string | null
  price_override_reason?: string | null
  price_overridden_by?: number | string | null
  price_overridden_at?: string | null
  staff_splits?: Array<{
    staff_id: number
    staff_name: string
    share_percent: number
    commission_rate_snapshot?: number
  }>
  children?: OrderDetailLine[]
}

type OrderActionLogEntry = {
  id: number
  action_type: string
  before_value?: Record<string, unknown> | null
  after_value?: Record<string, unknown> | null
  remark?: string | null
  created_at?: string | null
  created_by_name?: string | null
}

type OrderDetail = {
  order: {
    id: number
    order_no: string
    order_datetime: string
    customer: string
    payment_method: string
    payments?: PaymentBreakdownRow[]
    type: string
    booking_no?: string | null
    assigned_staff_name?: string | null
    status: string
    grand_total: number
    payment_proofs?: PaymentProof[]
    receipt_public_url?: string | null
    customer_email?: string | null
    notes?: string | null
    void_remarks?: string | null
    settlement_notes?: string | null
    reschedule_reason?: string | null
  }
  lines: OrderDetailLine[]
  action_logs?: OrderActionLogEntry[]
}


function ReportNameStack({ name, cnName }: { name?: string | null; cnName?: string | null }) {
  const displayCnName = cnName?.trim()

  return (
    <div className="min-w-0">
      <p className="font-medium text-gray-900">{name || '—'}</p>
      {displayCnName ? <p className="mt-0.5 text-xs text-gray-500">{displayCnName}</p> : null}
    </div>
  )
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: formatDateInput(start), to: formatDateInput(end) }
}

const getTodayRange = () => {
  const d = formatDateInput(new Date())
  return { from: d, to: d }
}

const formatDisplayDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString || '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

const formatDisplayDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const labelize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

const actionLogTitle = (actionType: string) => {
  const labels: Record<string, string> = {
    edit_bill_date: 'Bill date updated',
    edit_payment_method: 'Payment method updated',
    edit_sales_person: 'Sales person updated',
    edit_worker: 'Worker updated',
    void_order: 'Order voided',
  }
  return labels[actionType] ?? actionType.replace(/_/g, ' ')
}

const actionLogChangeSummary = (log: OrderActionLogEntry) => {
  if (log.action_type === 'edit_bill_date') {
    const before = typeof log.before_value?.placed_at === 'string' ? log.before_value.placed_at : null
    const after = typeof log.after_value?.placed_at === 'string' ? log.after_value.placed_at : null
    if (before && after) return `${formatDisplayDateTime(before)} → ${formatDisplayDateTime(after)}`
  }
  if (log.action_type === 'edit_payment_method') {
    const before = log.before_value?.payment_method
    const after = log.after_value?.payment_method
    if (before || after) return `${labelize(String(before ?? '—'))} → ${labelize(String(after ?? '—'))}`
  }
  return null
}

/** Table display: match gateway / order `payment_method` keys to readable labels. */
const PAYMENT_METHOD_TABLE_LABELS: Record<string, string> = {
  billplz_online_banking: 'Online Banking (Billplz)',
  billplz_fpx: 'Online Banking (Billplz)',
  billplz_credit_card: 'Credit Card (Billplz)',
  billplz_card: 'Credit Card (Billplz)',
}

const paymentMethodDisplayLabel = (raw: string) => {
  const key = (raw ?? '').trim().toLowerCase()
  if (!key) return '—'
  return PAYMENT_METHOD_TABLE_LABELS[key] ?? labelize(raw)
}

const discountTypeDisplayLabel = (raw?: string | null) => {
  const key = String(raw ?? '').trim()
  return key ? labelize(key) : '—'
}

const discountValueDisplay = (type?: string | null, value?: number) => {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return '—'
  return type === 'percentage' ? `${formatAmount(amount)}%` : `RM ${formatAmount(amount)}`
}

const priceOverrideDisplay = (line: OrderDetailLine) => {
  const snapshot = line.price_override ?? null
  const original = Number(snapshot?.original_unit_price ?? snapshot?.original_unit_price_snapshot ?? line.original_unit_price ?? NaN)
  const adjusted = Number(snapshot?.final_unit_price ?? snapshot?.unit_price_snapshot ?? line.final_unit_price ?? NaN)
  const reason = snapshot?.price_override_reason ?? line.price_override_reason ?? null
  const mode = snapshot?.price_override_mode ?? null
  const changedBy = snapshot?.price_overridden_by_label ?? snapshot?.price_overridden_by ?? line.price_overridden_by ?? null
  const changedAt = snapshot?.price_overridden_at ?? line.price_overridden_at ?? null

  if (!Number.isFinite(original) && !Number.isFinite(adjusted) && !mode && !reason && !changedBy && !changedAt) return '—'

  return (
    <div className="space-y-1 text-xs">
      {Number.isFinite(original) ? <p>Original: RM {formatAmount(original)}</p> : null}
      {Number.isFinite(adjusted) ? <p className="font-semibold text-blue-700">Adjusted: RM {formatAmount(adjusted)}</p> : null}
      {mode ? <p>Mode: {mode === 'line_total' ? 'Line Total' : 'Unit Price'}</p> : null}
      {reason ? <p className="rounded bg-blue-50 px-2 py-1 text-blue-800">{reason}</p> : null}
      {changedBy ? <p className="text-slate-500">By: {changedBy}</p> : null}
      {changedAt ? <p className="text-slate-500">At: {formatDisplayDateTime(String(changedAt))}</p> : null}
    </div>
  )
}

const isBookingWorkerSplitLine = (lineType?: string | null) => {
  const t = normalizeBookingType(lineType)
  return t === 'booking_deposit' || t === 'deposit' || t === 'booking_settlement' || t === 'final_settlement'
}

const staffSplitColumnLabel = (lineType?: string | null) =>
  isBookingWorkerSplitLine(lineType) ? 'Assigned staff' : 'Staff split'

const staffSplitDisplay = (line: OrderDetailLine) => {
  const splits = Array.isArray(line.staff_splits) ? line.staff_splits : []
  if (splits.length > 0) {
    return splits.map((split) => `${split.staff_name} ${split.share_percent}%`).join(', ')
  }
  return line.assigned_staff_name || line.staff_name || '—'
}

type DisplayOrderDetailLine = OrderDetailLine & { isChildLine?: boolean; parentName?: string }

const flattenOrderDetailLines = (lines: OrderDetailLine[]): DisplayOrderDetailLine[] =>
  lines.flatMap((line) => [
    line,
    ...((line.children ?? []).map((child) => ({ ...child, isChildLine: true, parentName: line.name })) as DisplayOrderDetailLine[]),
  ])


const normalizedPaymentBreakdown = (payments?: PaymentBreakdownRow[]) => {
  if (!Array.isArray(payments)) return []
  return payments
    .map((payment, index) => {
      const method = String(payment.method ?? payment.payment_method ?? '').trim()
      const amount = Number(payment.amount ?? 0)
      return { method, amount, key: `${method || 'payment'}-${amount}-${payment.reference_no ?? index}` }
    })
    .filter((payment) => payment.method && Number.isFinite(payment.amount) && payment.amount > 0)
}

const PaymentMethodCell = ({ method, payments }: { method: string; payments?: PaymentBreakdownRow[] }) => {
  const rows = normalizedPaymentBreakdown(payments)
  if (rows.length === 0) return <>{paymentMethodDisplayLabel(method)}</>
  if (rows.length === 1) return <>{paymentMethodDisplayLabel(rows[0].method)}</>

  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-slate-800">Split</p>
      {rows.map((payment) => (
        <p key={payment.key} className="text-xs text-slate-600">
          {paymentMethodDisplayLabel(payment.method)} · RM {formatAmount(payment.amount)}
        </p>
      ))}
    </div>
  )
}

const normalizeBookingType = (value?: string | null) => String(value ?? '').trim().toLowerCase()
const isBookingDepositType = (value?: string | null) => {
  const t = normalizeBookingType(value)
  return t === 'booking_deposit' || t === 'deposit'
}
const isBookingWorkerType = (value?: string | null) => {
  const t = normalizeBookingType(value)
  return t === 'final_settlement' || t === 'booking_settlement' || t === 'settlement_services' || t === 'settlement_service'
}


const groupKeyForOrder = (row: { order_no?: string | null; transaction_no?: string | null; order_id: number }) => {
  const transactionNo = String(row.transaction_no ?? '').trim()
  const orderNo = String(row.order_no ?? '').trim()
  return transactionNo || orderNo || `order-${row.order_id}`
}

const sameOrMultiple = (values: Array<string | null | undefined>, fallback: string | null = '—') => {
  const unique = Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))
  if (unique.length === 0) return fallback
  if (unique.length === 1) return unique[0]
  return 'Multiple'
}

const summarizeMore = (value: string | null | undefined, additionalCount: number, fallback = 'View details') => {
  const label = String(value ?? '').trim() || fallback
  return additionalCount > 0 ? `${label} +${additionalCount} more` : label
}

const bookingTypeSummary = (types: string[]) => {
  const unique = Array.from(new Set(types.map((type) => String(type ?? '').trim()).filter(Boolean)))
  if (unique.length === 0) return 'Booking'
  if (unique.length === 1) return unique[0]
  const hasSettlement = unique.some((type) => isBookingWorkerType(type))
  const hasAddOns = unique.some((type) => ['addon', 'add_on', 'booking_addon', 'booking_product'].includes(normalizeBookingType(type)))
  if (hasSettlement && hasAddOns) return 'Final Settlement + Add-ons'
  return `${labelize(unique[0])} + ${unique.length - 1} more`
}

/** Table header: only the first character is uppercase (no full-string caps). */
const reportTableColumnHeader = (label: string) =>
  label ? `${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}` : label

export default function SalesChannelReportPage({
  mode,
  canExport = false,
  canUpdateOrder,
  defaultDatePreset = 'month',
  paramPrefix,
  isAllWorkspace = false,
  showDateInputsInFilterModal = true,
  onDataChanged,
}: {
  mode: Mode
  canExport?: boolean
  canUpdateOrder?: boolean
  defaultDatePreset?: 'month' | 'today'
  /** When set (e.g. `ec_`), URL uses `{prefix}page` and `{prefix}per_page` instead of `page` / `per_page`. */
  paramPrefix?: string
  /** When true with `paramPrefix`, filter apply/reset also resets the sibling table pages (`ec_page` / `bk_page`). */
  isAllWorkspace?: boolean
  /** Sales Visual manages date elsewhere; hide date inputs in modal. */
  showDateInputsInFilterModal?: boolean
  onDataChanged?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(
    () => (defaultDatePreset === 'today' ? getTodayRange() : getDefaultRange()),
    [defaultDatePreset],
  )

  const pageKey = paramPrefix ? `${paramPrefix}page` : 'page'
  const perPageKey = paramPrefix ? `${paramPrefix}per_page` : 'per_page'

  const resolved = useMemo(() => {
    const parsedPage = Number(searchParams.get(pageKey))
    const parsedPerPage = Number(searchParams.get(perPageKey))
    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      channel: searchParams.get('channel') ?? 'all',
      paymentMethod: searchParams.get('payment_method') ?? 'all',
      status: searchParams.get('status') ?? 'all',
      type: searchParams.get('type') ?? 'all',
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE,
      perPage: Number.isFinite(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : DEFAULT_PAGE_SIZE,
    }
  }, [searchParams, defaultRange.from, defaultRange.to, pageKey, perPageKey])

  const [inputs, setInputs] = useState(resolved)
  const [ecommerceRows, setEcommerceRows] = useState<EcommerceRow[]>([])
  const [bookingRows, setBookingRows] = useState<BookingRow[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [totalsPage, setTotalsPage] = useState<Record<string, number>>({})
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({})
  const [pagination, setPagination] = useState<Pagination>({ total: 0, per_page: DEFAULT_PAGE_SIZE, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'photos'>('details')
  const [detailBookingId, setDetailBookingId] = useState<number | null>(null)
  const [selectedDetailLine, setSelectedDetailLine] = useState<OrderDetailLine | null>(null)

  useEffect(() => {
    setInputs(resolved)
  }, [resolved])

  useEffect(() => {
    const controller = new AbortController()
    const fetchData = async () => {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set('date_from', resolved.dateFrom)
      qs.set('date_to', resolved.dateTo)
      qs.set('channel', resolved.channel)
      qs.set('page', String(resolved.page))
      qs.set('per_page', String(resolved.perPage))
      if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
      if (mode === 'ecommerce' && resolved.status !== 'all') qs.set('status', resolved.status)
      if (mode === 'booking' && resolved.type !== 'all') qs.set('type', resolved.type)

      const response = await fetch(`/api/proxy/ecommerce/reports/sales/${mode}?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        setEcommerceRows([])
        setBookingRows([])
        setSummary({})
        setTotalsPage({})
        setGrandTotals({})
        setPagination({ total: 0, per_page: resolved.perPage, current_page: 1, last_page: 1 })
        setLoading(false)
        return
      }

      const data: EcommerceResponse | BookingResponse = await response.json()
      setSummary((data.summary as Record<string, number>) ?? {})
      setTotalsPage((data.totals_page as Record<string, number>) ?? {})
      setGrandTotals((data.grand_totals as Record<string, number>) ?? {})
      setPagination({
        total: data.pagination?.total ?? 0,
        per_page: data.pagination?.per_page ?? resolved.perPage,
        current_page: data.pagination?.current_page ?? resolved.page,
        last_page: data.pagination?.last_page ?? 1,
      })
      if (mode === 'ecommerce') {
        setEcommerceRows((data.rows as EcommerceRow[]) ?? [])
      } else {
        setBookingRows((data.rows as BookingRow[]) ?? [])
      }
      setLoading(false)
    }

    void fetchData()
    return () => controller.abort()
  }, [mode, resolved, refreshKey])

  const updateQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(patch).forEach(([k, v]) => next.set(k, v))
    router.push(`${pathname}?${next.toString()}`)
  }

  const handleApply = () => {
    const patch: Record<string, string> = {
      date_from: inputs.dateFrom,
      date_to: inputs.dateTo,
      channel: inputs.channel,
      payment_method: inputs.paymentMethod,
      status: inputs.status,
      type: inputs.type,
    }
    if (paramPrefix) {
      patch[pageKey] = '1'
      if (isAllWorkspace) {
        patch.ec_page = '1'
        patch.bk_page = '1'
      }
    } else {
      patch.page = '1'
    }
    updateQuery(patch)
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    const range = defaultDatePreset === 'today' ? getTodayRange() : defaultRange
    const patch: Record<string, string> = {
      date_from: range.from,
      date_to: range.to,
      channel: 'all',
      payment_method: 'all',
      status: 'all',
      type: 'all',
    }
    if (paramPrefix) {
      patch[pageKey] = '1'
      if (isAllWorkspace) {
        patch.ec_page = '1'
        patch.bk_page = '1'
      }
    } else {
      patch.page = '1'
    }
    updateQuery(patch)
    setIsFilterOpen(false)
  }

  const openOrderDetail = async (orderId: number, bookingId?: number | null) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setOrderDetail(null)
    setDetailTab('details')
    setDetailBookingId(bookingId ?? null)

    try {
      const response = await fetch(`/api/proxy/admin/reports/sales/${orderId}/details`, { cache: 'no-store' })
      const data = await response.json().catch(() => null) as OrderDetail | { message?: string } | null
      if (!response.ok) {
        setDetailError(data && 'message' in data && typeof data.message === 'string' ? data.message : 'Unable to load order details.')
        return
      }
      setOrderDetail(data as OrderDetail)
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Unable to load order details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const openBookingDetail = async (row: BookingRow) => {
    await openOrderDetail(row.order_id, row.booking_id ?? null)
  }

  const closeOrderDetail = () => {
    setDetailOpen(false)
    setDetailError(null)
    setOrderDetail(null)
    setDetailTab('details')
    setDetailBookingId(null)
    setSelectedDetailLine(null)
  }

  const detailLines = orderDetail ? flattenOrderDetailLines(orderDetail.lines) : []

  const showingRange = `${formatDisplayDate(resolved.dateFrom)} – ${formatDisplayDate(resolved.dateTo)}`
  const activeFilters = [
    { label: 'Date Range', value: showingRange },
    ...(resolved.channel !== 'all' ? [{ label: 'Channel', value: labelize(resolved.channel) }] : []),
    ...(resolved.paymentMethod !== 'all' ? [{ label: 'Payment', value: labelize(resolved.paymentMethod) }] : []),
    ...(mode === 'ecommerce' && resolved.status !== 'all' ? [{ label: 'Status', value: labelize(resolved.status) }] : []),
    ...(mode === 'booking' && resolved.type !== 'all' ? [{ label: 'Type', value: labelize(resolved.type) }] : []),
  ]

  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('date_from', resolved.dateFrom)
    qs.set('date_to', resolved.dateTo)
    qs.set('channel', resolved.channel)
    if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
    if (mode === 'ecommerce' && resolved.status !== 'all') qs.set('status', resolved.status)
    if (mode === 'booking' && resolved.type !== 'all') qs.set('type', resolved.type)
    return `/api/proxy/ecommerce/reports/sales/export/${mode}?${qs.toString()}`
  }, [mode, resolved])

  const groupedEcommerceRows = useMemo(() => {
    const groups = new Map<string, EcommerceRow>()
    ecommerceRows.forEach((row) => {
      const key = groupKeyForOrder(row)
      const current = groups.get(key)
      if (!current) {
        groups.set(key, { ...row })
        return
      }
      groups.set(key, {
        ...current,
        item_count: Number(current.item_count ?? 0) + Number(row.item_count ?? 0),
        product_amount: Number(current.product_amount ?? 0) + Number(row.product_amount ?? 0),
        discount: Number(current.discount ?? 0) + Number(row.discount ?? 0),
        net_amount: Number(current.net_amount ?? 0) + Number(row.net_amount ?? 0),
        order_total: Number(current.net_amount ?? 0) + Number(row.net_amount ?? 0),
      })
    })
    return Array.from(groups.values())
  }, [ecommerceRows])

  const groupedBookingRows = useMemo(() => {
    const groups = new Map<string, { first: BookingRow; rows: BookingRow[] }>()
    bookingRows.forEach((row) => {
      const key = groupKeyForOrder(row)
      const current = groups.get(key)
      if (!current) {
        groups.set(key, { first: row, rows: [row] })
        return
      }
      current.rows.push(row)
    })

    return Array.from(groups.values()).map(({ first, rows }) => {
      const additionalCount = Math.max(rows.length - 1, 0)
      const bookingNo = sameOrMultiple(rows.map((row) => row.booking_no), null)
      return {
        ...first,
        type: bookingTypeSummary(rows.map((row) => row.type)),
        booking_id: bookingNo === first.booking_no ? first.booking_id : null,
        booking_no: bookingNo,
        package_name: summarizeMore(first.package_name, additionalCount),
        gross_amount: rows.reduce((total, row) => total + Number(row.gross_amount ?? 0), 0),
        discount: rows.reduce((total, row) => total + Number(row.discount ?? 0), 0),
        net_amount: rows.reduce((total, row) => total + Number(row.net_amount ?? 0), 0),
        order_total: rows.reduce((total, row) => total + Number(row.net_amount ?? 0), 0),
      }
    })
  }, [bookingRows])

  const ecColSpan = 11
  const bkColSpan = 13

  return (
    <div className="space-y-6">
      {isFilterOpen ? (
        <CrmFilterModalShell
          title="Filter"
          onClose={() => setIsFilterOpen(false)}
          closeLabel="Close"
          footer={(
            <>
              <button type="button" onClick={handleReset} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
                Reset
              </button>
              <button type="button" onClick={handleApply} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                Apply Filter
              </button>
            </>
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {showDateInputsInFilterModal ? (
              <>
                <input
                  type="date"
                  value={inputs.dateFrom}
                  onChange={(e) => setInputs((p) => ({ ...p, dateFrom: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm"
                />
                <input
                  type="date"
                  value={inputs.dateTo}
                  onChange={(e) => setInputs((p) => ({ ...p, dateTo: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm"
                />
              </>
            ) : null}
            <select
              value={inputs.channel}
              onChange={(e) => setInputs((p) => ({ ...p, channel: e.target.value }))}
              className="h-10 rounded border border-slate-200 px-3 text-sm"
            >
              <option value="all">All Channels</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <select
              value={inputs.paymentMethod}
              onChange={(e) => setInputs((p) => ({ ...p, paymentMethod: e.target.value }))}
              className="h-10 rounded border border-slate-200 px-3 text-sm"
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online_banking">Online Banking</option>
            </select>
            {mode === 'ecommerce' ? (
              <select
                value={inputs.status}
                onChange={(e) => setInputs((p) => ({ ...p, status: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm sm:col-span-2"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="completed">Completed</option>
              </select>
            ) : (
              <select
                value={inputs.type}
                onChange={(e) => setInputs((p) => ({ ...p, type: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm sm:col-span-2"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="final_settlement">Final Settlement</option>
                <option value="addon">Add-on</option>
                <option value="package_purchase">Package Purchase</option>
                <option value="booking_product">Booking Product</option>
              </select>
            )}
          </div>
        </CrmFilterModalShell>
      ) : null}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <button type="button" onClick={() => setIsFilterOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
          <i className="fa-solid fa-filter" />
          Filter
        </button>
        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="pageSize"
            value={resolved.perPage}
            onChange={(event) => updateQuery({ [perPageKey]: event.target.value, [pageKey]: '1' })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {canExport && (
            <a href={exportUrl} className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" target="_blank" rel="noreferrer">
              <i className="fa-solid fa-download" />
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {activeFilters.map((filter) => (
          <span key={`${filter.label}-${filter.value}`} className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
            <span className="font-medium">{filter.label}</span>
            <span>{filter.value}</span>
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Summary</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {mode === 'ecommerce' ? (
            <>
              <SummaryCard label="Total Sales" value={`RM ${formatAmount(summary.total_sales ?? 0)}`} />
              <SummaryCard label="Online Sales" value={`RM ${formatAmount(summary.online_sales ?? 0)}`} />
              <SummaryCard label="Offline Sales" value={`RM ${formatAmount(summary.offline_sales ?? 0)}`} />
              <SummaryCard label="Total Orders" value={(summary.total_orders ?? 0).toLocaleString()} />
            </>
          ) : (
            <>
              <SummaryCard label="Total Booking Revenue" value={`RM ${formatAmount(summary.total_booking_revenue ?? 0)}`} />
              <SummaryCard label="Booking Deposit Amount" value={`RM ${formatAmount(summary.booking_deposit_amount ?? 0)}`} />
              <SummaryCard label="Booking Settlement Amount" value={`RM ${formatAmount(summary.booking_settlement_amount ?? 0)}`} />
              <SummaryCard label="Add-on Revenue" value={`RM ${formatAmount(summary.addon_revenue ?? 0)}`} />
              <SummaryCard label="Package Purchase Amount" value={`RM ${formatAmount(summary.package_purchase_amount ?? 0)}`} />
              <SummaryCard label="Booking Product Amount" value={`RM ${formatAmount(summary.booking_product_amount ?? 0)}`} />
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {mode === 'ecommerce' ? (
                ['Order No', 'Bill Date', 'Customer', 'Channel', 'Payment Method', 'Item Count', 'Product Amount', 'Discount', 'Net Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600">
                    {reportTableColumnHeader(h)}
                  </th>
                ))
              ) : (
                ['Order No', 'Bill Date', 'Customer', 'Channel', 'Payment Method', 'Type', 'Booking No', 'Name', 'Gross Amount', 'Discount', 'Net Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600">
                    {reportTableColumnHeader(h)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={mode === 'ecommerce' ? ecColSpan : bkColSpan} />
            ) : mode === 'ecommerce' ? (
              groupedEcommerceRows.length === 0 ? (
                <TableEmptyState colSpan={ecColSpan} />
              ) : (
                groupedEcommerceRows.map((row) => (
                  <tr key={`${row.order_no}-${row.order_datetime}`}>
                    <td className="px-4 py-2 border border-gray-200">{row.order_no}</td>
                    <td className="px-4 py-2 border border-gray-200">{formatDisplayDateTime(row.order_datetime)}</td>
                    <td className="px-4 py-2 border border-gray-200 font-medium">{row.customer}</td>
                    <td className="px-4 py-2 border border-gray-200">{labelize(row.channel)}</td>
                    <td className="px-4 py-2 border border-gray-200"><PaymentMethodCell method={row.payment_method} payments={row.payments} /></td>
                    <td className="px-4 py-2 border border-gray-200">{row.item_count}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.product_amount)}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.discount)}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.net_amount)}</td>
                    <td className="px-4 py-2 border border-gray-200">{labelize(row.status)}</td>
                    <td className="px-4 py-2 border border-gray-200 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        <ReportViewDetailsButton onClick={() => void openOrderDetail(row.order_id)} title={`View details for ${row.order_no}`} />
                        <OrderReceiptAction orderId={row.order_id} orderNo={row.order_no} />
                      <OfflineOrderActions
                        orderId={row.order_id}
                        channel={row.channel}
                        billDate={row.order_datetime}
                        currentPaymentMethod={row.payment_method}
                        orderAmount={Number(row.order_total ?? row.net_amount ?? 0)}
                        paymentBreakdown={row.payments}
                        canEditStaffSplit={canUpdateOrder}
                        onDone={() => {
                          setRefreshKey((prev) => prev + 1)
                          onDataChanged?.()
                        }}
                      />
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : groupedBookingRows.length === 0 ? (
              <TableEmptyState colSpan={bkColSpan} />
            ) : (
              groupedBookingRows.map((row, idx) => (
                <tr key={`${row.order_no}-${idx}`}>
                  <td className="px-4 py-2 border border-gray-200">{row.order_no}</td>
                  <td className="px-4 py-2 border border-gray-200">{formatDisplayDateTime(row.order_datetime)}</td>
                  <td className="px-4 py-2 border border-gray-200 font-medium">{row.customer}</td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.channel)}</td>
                  <td className="px-4 py-2 border border-gray-200"><PaymentMethodCell method={row.payment_method} payments={row.payments} /></td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.type)}</td>
                  <td className="px-4 py-2 border border-gray-200">{row.booking_no ?? '—'}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    <ReportNameStack name={row.package_name} cnName={row.package_cn_name} />
                  </td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.gross_amount)}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.discount)}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.net_amount)}</td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.status)}</td>
                  <td className="px-4 py-2 border border-gray-200 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      <ReportViewDetailsButton onClick={() => void openBookingDetail(row)} title={row.booking_no ? `View booking details for ${row.booking_no}` : `View details for ${row.order_no}`} />
                      <OrderReceiptAction orderId={row.order_id} orderNo={row.order_no} />
                    <OfflineOrderActions
                      orderId={row.order_id}
                      channel={row.channel}
                      billDate={row.order_datetime}
                      currentPaymentMethod={row.payment_method}
                      orderAmount={Number(row.order_total ?? row.net_amount ?? 0)}
                      paymentBreakdown={row.payments}
                      staffActionLabel={isBookingWorkerType(row.type) ? 'worker' : 'sales_person'}
                      hideStaffAction={isBookingDepositType(row.type)}
                      canEditStaffSplit={canUpdateOrder}
                      onDone={() => {
                        setRefreshKey((prev) => prev + 1)
                        onDataChanged?.()
                      }}
                    />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            {mode === 'ecommerce' ? (
              <>
                <tr className="bg-gray-100 font-semibold">
                  <td className="border border-gray-300 px-4 py-2 text-left">Page Totals</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">{(totalsPage.orders_count ?? 0).toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.product_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-4 py-2 text-left">Grand Totals</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">{(grandTotals.orders_count ?? 0).toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.product_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
              </>
            ) : (
              <>
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={8} className="border border-gray-300 px-4 py-2 text-left">
                    Page Totals
                  </td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.gross_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={8} className="border border-gray-300 px-4 py-2 text-left">
                    Grand Totals
                  </td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.gross_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {detailOpen ? (
        <ReportDetailDrawer
          open={detailOpen}
          title={orderDetail?.order.order_no ?? 'Loading…'}
          subtitle={orderDetail?.order.booking_no ? `Booking ${orderDetail.order.booking_no}` : 'Transaction details'}
          onClose={closeOrderDetail}
          loading={detailLoading}
          loadingText="Loading order details…"
          error={detailError}
          maxWidthClassName="max-w-5xl"
        >
            {detailBookingId ? (
              <div className="border-b border-slate-200 px-5 pt-3">
                <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
                  <button type="button" onClick={() => setDetailTab('details')} className={`rounded-md px-3 py-1.5 ${detailTab === 'details' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Details</button>
                  <button type="button" onClick={() => setDetailTab('photos')} className={`rounded-md px-3 py-1.5 ${detailTab === 'photos' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Photos</button>
                </div>
              </div>
            ) : null}

            <div>
              {detailTab === 'photos' && detailBookingId ? (
                <BookingServicePhotosPanel bookingId={detailBookingId} />
              ) : orderDetail ? (
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900">Order Info</h4>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <DetailMeta label="Order no" value={orderDetail.order.order_no} />
                      <DetailMeta label="Bill date" value={formatDisplayDateTime(orderDetail.order.order_datetime)} />
                      <DetailMeta label="Customer" value={orderDetail.order.customer} />
                      <DetailMeta label="Payment method" value={<PaymentMethodCell method={orderDetail.order.payment_method} payments={orderDetail.order.payments} />} />
                      <DetailMeta label="Type" value={orderDetail.order.type} />
                      <DetailMeta label="Booking no" value={orderDetail.order.booking_no ?? '—'} />
                      {orderDetail.order.assigned_staff_name ? (
                        <DetailMeta label="Assigned staff" value={orderDetail.order.assigned_staff_name} />
                      ) : null}
                      <DetailMeta label="Status" value={labelize(orderDetail.order.status)} />
                      <DetailMeta label="Grand total" value={`RM ${formatAmount(orderDetail.order.grand_total)}`} />
                    </div>
                    {(() => {
                      const remarkLines = getAppointmentDisplayRemarkLines(orderDetail.order)
                      if (remarkLines.length === 0) return null
                      return (
                        <div className="mt-4 space-y-1 border-t border-slate-100 pt-4">
                          {remarkLines.map((line) => (
                            <p key={`order-remark-${line.key}`} className="text-xs font-medium text-slate-600">
                              <span className="text-slate-500">{line.label}:</span>{' '}
                              <span className="whitespace-pre-wrap">{line.value}</span>
                            </p>
                          ))}
                        </div>
                      )
                    })()}
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900">Payment Proof</h4>
                    <div className="mt-3">
                      <PaymentProofPreview proofs={orderDetail.order.payment_proofs} />
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-3 font-semibold text-slate-900">Line Items</h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Line</th>
                          <th className="px-3 py-2 text-left font-semibold">Qty / unit</th>
                          <th className="px-3 py-2 text-right font-semibold">Gross</th>
                          <th className="px-3 py-2 text-right font-semibold">Discount</th>
                          <th className="px-3 py-2 text-right font-semibold">Net</th>
                          <th className="px-3 py-2 text-left font-semibold">Discount details</th>
                          <th className="px-3 py-2 text-left font-semibold">Price override</th>
                          <th className="px-3 py-2 text-left font-semibold">
                            {detailLines.some((line) => isBookingWorkerSplitLine(line.line_type)) ? 'Assigned staff' : 'Staff split'}
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailLines.map((line) => (
                          <tr key={line.id} className={`align-top ${line.isChildLine ? 'bg-indigo-50/40' : ''}`}>
                            <td className="px-3 py-3">
                              <p className="text-xs font-semibold uppercase text-slate-400">{line.type_label}</p>
                              {line.isChildLine && line.parentName ? <p className="mt-1 text-xs text-indigo-700">Add-on for {line.parentName}</p> : null}
                              <p className="mt-1 font-semibold text-slate-900">{line.isChildLine ? `↳ ${line.name}` : line.name}</p>
                              {line.cn_name ? <p className="mt-0.5 text-xs text-slate-500">{line.cn_name}</p> : null}
                              {line.variant_name ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  <p>Variant: {line.variant_name}</p>
                                  {line.variant_cn_name ? <p>{line.variant_cn_name}</p> : null}
                                </div>
                              ) : null}
                              {line.booking_no ? <p className="mt-1 text-xs text-blue-700">Booking: {line.booking_no}</p> : null}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">
                              <p>{line.qty}</p>
                              <p className="text-xs text-slate-500">RM {formatAmount(line.unit_price)}</p>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">RM {formatAmount(line.gross_amount)}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-amber-700">RM {formatAmount(line.discount_amount)}</td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">RM {formatAmount(line.net_amount)}</td>
                            <td className="px-3 py-3 text-slate-700">
                              <p>{discountTypeDisplayLabel(line.discount_type)}</p>
                              <p className="text-xs text-slate-500">{discountValueDisplay(line.discount_type, line.discount_value)}</p>
                              {line.discount_remark ? <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">{line.discount_remark}</p> : null}
                            </td>
                            <td className="px-3 py-3 text-slate-700">{priceOverrideDisplay(line)}</td>
                            <td className="px-3 py-3 text-slate-700">{staffSplitDisplay(line)}</td>
                            <td className="px-3 py-3">
                              <ReportViewDetailsButton
                                onClick={() => setSelectedDetailLine(line)}
                                title={`View details for ${line.name}`}
                                className="h-7 min-w-7 px-1.5"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-900">Activity Log</h4>
                    {(orderDetail.action_logs ?? []).length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {orderDetail.action_logs?.map((log) => {
                          const changeSummary = actionLogChangeSummary(log)
                          return (
                            <div key={log.id} className="rounded-lg bg-slate-50 px-3 py-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className="font-semibold text-slate-900">{actionLogTitle(log.action_type)}</span>
                                <span className="text-xs text-slate-500">{log.created_at ? formatDisplayDateTime(log.created_at) : '—'}</span>
                              </div>
                              {log.created_by_name ? <p className="mt-1 text-xs text-slate-500">By {log.created_by_name}</p> : null}
                              {changeSummary ? <p className="mt-2 text-xs text-slate-700">{changeSummary}</p> : null}
                              {log.remark ? <p className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">{log.remark}</p> : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No staff actions recorded for this order.</p>
                    )}
                  </section>
                </div>
              ) : null}
            </div>
        </ReportDetailDrawer>
      ) : null}


      {selectedDetailLine ? (
        <ReportDetailDrawer
          open
          title={selectedDetailLine.name}
          subtitle={selectedDetailLine.type_label}
          onClose={() => setSelectedDetailLine(null)}
          maxWidthClassName="max-w-3xl"
          zIndexClassName="z-[60]"
        >
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Basic</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailMeta label="Line type" value={selectedDetailLine.type_label} />
                <DetailMeta label="Name" value={selectedDetailLine.name} />
                <DetailMeta label="Chinese name" value={selectedDetailLine.cn_name || '—'} />
                <DetailMeta label="Quantity" value={String(selectedDetailLine.qty)} />
                <DetailMeta label="Original unit price" value={`RM ${formatAmount(Number(selectedDetailLine.price_override?.original_unit_price ?? selectedDetailLine.price_override?.original_unit_price_snapshot ?? selectedDetailLine.unit_price ?? 0))}`} />
                <DetailMeta label="Final unit price" value={`RM ${formatAmount(Number(selectedDetailLine.price_override?.final_unit_price ?? selectedDetailLine.price_override?.unit_price_snapshot ?? selectedDetailLine.unit_price ?? 0))}`} />
                <DetailMeta label="Original line total" value={`RM ${formatAmount(Number(selectedDetailLine.price_override?.original_line_total ?? selectedDetailLine.original_line_total ?? selectedDetailLine.gross_amount ?? 0))}`} />
                <DetailMeta label="Final line total" value={`RM ${formatAmount(Number(selectedDetailLine.price_override?.final_line_total ?? selectedDetailLine.final_line_total ?? selectedDetailLine.gross_amount ?? 0))}`} />
                <DetailMeta label="Discount" value={`RM ${formatAmount(selectedDetailLine.discount_amount)}`} />
                <DetailMeta label="Net amount" value={`RM ${formatAmount(selectedDetailLine.net_amount)}`} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Price Override Audit</h4>
              <div className="mt-3 text-sm text-slate-700">{priceOverrideDisplay(selectedDetailLine)}</div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Add-ons / Options</h4>
              {(selectedDetailLine.children ?? []).length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Line</th>
                        <th className="px-3 py-2 text-left font-semibold">Qty / unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Line total</th>
                        <th className="px-3 py-2 text-right font-semibold">Discount</th>
                        <th className="px-3 py-2 text-left font-semibold">Price override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedDetailLine.children ?? []).map((child) => (
                        <tr key={child.id} className="align-top">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900">{child.name}</p>
                            {child.cn_name ? <p className="text-xs text-slate-500">{child.cn_name}</p> : null}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-slate-700">
                            <p>{child.qty}</p>
                            <p className="text-xs text-slate-500">RM {formatAmount(child.unit_price)}</p>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">RM {formatAmount(child.gross_amount)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-amber-700">RM {formatAmount(child.discount_amount)}</td>
                          <td className="px-3 py-3 text-slate-700">{priceOverrideDisplay(child)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No add-ons/options recorded for this line.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {staffSplitColumnLabel(selectedDetailLine.line_type)}
              </h4>
              <p className="mt-3 text-sm text-slate-700">{staffSplitDisplay(selectedDetailLine)}</p>
            </section>
          </div>
        </ReportDetailDrawer>
      ) : null}

      <PaginationControls
        currentPage={pagination.current_page}
        totalPages={pagination.last_page}
        pageSize={pagination.per_page}
        onPageChange={(page) => updateQuery({ [pageKey]: String(page) })}
        disabled={loading}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-700">{value}</p>
    </div>
  )
}


function DetailMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 font-medium text-slate-800">{value}</div>
    </div>
  )
}
