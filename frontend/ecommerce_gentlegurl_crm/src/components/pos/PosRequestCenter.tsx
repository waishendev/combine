'use client'
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import OrderViewPanel from '@/components/OrderViewPanel'
import ReturnViewPanel from '@/components/ReturnViewPanel'
import { renderPosBodyModalPortal } from '@/components/pos/posBodyModalPortal'
import { calculateOrderStatus, detectOrderType, type OrderApiItem } from '@/components/orderUtils'
import type { PosAppointmentDetail } from '@/components/pos/posAppointmentTypes'
import {
  formatReturnStatusLabel,
  getReturnStatusPosBadgeClasses,
  isActiveReturnStatus,
  normalizeReturnStatus,
} from '@/lib/returns/returnStatus'

export type PosRequestCenterProps = {
  disabled?: boolean
  disabledTitle?: string
  canReviewBookingRequests?: boolean
  onBookingRequestsChanged?: () => void | Promise<void>
  permissions?: string[]
}

type BookingCancellationRequestRow = {
  id: number
  booking_id?: number | null
  requested_at?: string | null
  created_at?: string | null
  status?: string | null
  reason?: string | null
  admin_note?: string | null
  booking?: {
    id?: number | null
    booking_code?: string | null
    guest_name?: string | null
    guest_phone?: string | null
    guest_email?: string | null
    customer?: { name?: string | null; phone?: string | null; email?: string | null } | null
  } | null
}

type BookingHoldRow = {
  id: number
  booking_code?: string | null
  customer_name?: string | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  appointment_start_at?: string | null
  created_at?: string | null
  status?: string | null
  payment_status?: string | null
  hold_deposit_order?: {
    id: number
    order_number: string
    status?: string
    payment_status?: string
    grand_total?: number
  } | null
  hold_linked_bookings?: Array<{ id: number; booking_code: string; service_name?: string }>
}

type BookingRequestRow = {
  key: string
  id: number
  bookingId: number
  bookingIds: number[]
  requestId?: number
  requestTypes: Array<'Cancellation request' | 'Hold confirmation' | 'Deposit proof' | 'Package purchase'>
  requestType: 'Cancellation request' | 'Hold confirmation' | 'Deposit proof' | 'Package purchase'
  number: string
  orderId?: number
  orderNumber?: string
  bookingCode?: string
  bookingCodes: string[]
  linkedBookingCount: number
  customerName: string
  contact: string
  requestedAt: string | null
  status: string
  badgeClassName: string
  reason?: string | null
  adminNote?: string | null
  linkId?: number
  amount?: number
  slipUrl?: string | null
}

type PaymentLinkReviewRow = {
  id: number
  booking_id?: number | null
  booking_code?: string | null
  service_name?: string | null
  amount?: number | null
  manual_slip_url?: string | null
  customer_name?: string | null
  customer_contact?: string | null
  slip_uploaded_at?: string | null
}

type EcommerceRequestRow = {
  key: string
  kind: 'order' | 'return'
  id: number
  returnId?: number
  orderId?: number
  orderNo: string
  customerName: string
  contact: string
  createdAt: string
  statusLabel: string
  status: string
  paymentStatus: string
  shippingMethod?: string | null
  requestLabel?: string
}

type ReturnRequestApiRow = {
  id: number
  status?: string | null
  reason?: string | null
  request_type?: string | null
  refund_amount?: string | number | null
  created_at?: string | null
  order?: { id?: number; order_number?: string | null }
  customer?: { name?: string | null; phone?: string | null; email?: string | null }
  timeline?: { created_at?: string | null }
}

type BalanceTopupRow = { id: number; transaction_no?: string | null; amount?: string | number | null; workspace_type?: string | null; payment_method_label?: string | null; reference_no?: string | null; status?: string | null; created_at?: string | null; completed_at?: string | null; balance_before?: string | number | null; balance_after?: string | number | null; metadata?: Record<string, unknown> | null; customer?: { id?: number; name?: string | null; phone?: string | null; email?: string | null; wallet_balance?: string | number | null } | null }

type BookingConfirmState =
  | { kind: 'cancellation'; row: BookingRequestRow; action: 'approve' | 'reject' }
  | { kind: 'hold'; row: BookingRequestRow; action: 'approve' | 'reject' }
  | { kind: 'deposit_proof'; row: BookingRequestRow; action: 'approve' | 'reject' }
  | null

const ECOMMERCE_REQUEST_FILTERS = [
  { status: 'pending' },
  { status: 'processing' },
  { status: 'confirmed' },
  { status: 'ready_for_pickup' },
  { status: 'shipped' },
  { payment_status: 'failed' },
]

const BOOKING_PACKAGE_ORDER_FILTERS = [
  { status: 'pending', payment_status: 'unpaid' },
  { status: 'processing', payment_status: 'unpaid' },
]

const BOOKING_HOLD_FILTERS = ['HOLD', 'PENDING', 'PENDING_CONFIRMATION']

const RETURN_REQUEST_ACTIVE_STATUSES = ['requested', 'approved', 'in_transit', 'received'] as const

const BTN_ICON = 'inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50'

function ViewEyeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function dedupeByKey<T extends { key: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((row) => [row.key, row])).values())
}

function mergeBookingRequestRows(primary: BookingRequestRow, secondary: BookingRequestRow): BookingRequestRow {
  const requestTypes = Array.from(new Set([...primary.requestTypes, ...secondary.requestTypes]))
  const bookingIds = Array.from(new Set([...primary.bookingIds, ...secondary.bookingIds]))
  const bookingCodes = Array.from(new Set([...primary.bookingCodes, ...secondary.bookingCodes].filter(Boolean)))
  const requestedAt = [primary.requestedAt, secondary.requestedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] ?? null

  return {
    ...primary,
    key: primary.orderId ? `order-${primary.orderId}` : `booking-${primary.bookingId}`,
    bookingIds,
    bookingCodes,
    linkedBookingCount: Math.max(primary.linkedBookingCount, secondary.linkedBookingCount, bookingIds.length),
    requestTypes,
    requestType: requestTypes.includes('Deposit proof')
      ? 'Deposit proof'
      : requestTypes.includes('Hold confirmation')
        ? 'Hold confirmation'
        : requestTypes.includes('Package purchase')
          ? 'Package purchase'
          : 'Cancellation request',
    requestedAt,
    amount: secondary.amount ?? primary.amount,
    slipUrl: secondary.slipUrl ?? primary.slipUrl,
    linkId: secondary.linkId ?? primary.linkId,
    reason: secondary.reason ?? primary.reason,
    adminNote: secondary.adminNote ?? primary.adminNote,
    status: secondary.status || primary.status,
    badgeClassName: requestTypes.includes('Deposit proof')
      ? 'bg-blue-100 text-blue-800 ring-blue-200'
      : requestTypes.includes('Hold confirmation')
        ? 'bg-amber-100 text-amber-800 ring-amber-200'
        : requestTypes.includes('Package purchase')
          ? 'bg-purple-100 text-purple-800 ring-purple-200'
          : primary.badgeClassName,
  }
}

function enrichHoldRowsWithSharedOrder(rows: BookingRequestRow[]): BookingRequestRow[] {
  const sharedOrderByBookingId = new Map<
    number,
    { orderId: number; orderNumber?: string; bookingIds: number[]; bookingCodes: string[] }
  >()

  for (const row of rows) {
    if (!row.orderId || !row.requestTypes.includes('Hold confirmation')) continue
    const payload = {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      bookingIds: row.bookingIds,
      bookingCodes: row.bookingCodes,
    }
    row.bookingIds.forEach((id) => sharedOrderByBookingId.set(id, payload))
  }

  return rows.map((row) => {
    if (row.orderId || !row.requestTypes.includes('Hold confirmation')) return row
    const shared = sharedOrderByBookingId.get(row.bookingId)
    if (!shared) return row
    return {
      ...row,
      orderId: shared.orderId,
      orderNumber: shared.orderNumber,
      number: shared.orderNumber || row.number,
      bookingIds: shared.bookingIds,
      bookingCodes: shared.bookingCodes,
      linkedBookingCount: Math.max(shared.bookingIds.length, row.linkedBookingCount),
    }
  })
}

function consolidateBookingRequests(rows: BookingRequestRow[]): BookingRequestRow[] {
  const cancellations = rows.filter((row) => row.requestType === 'Cancellation request')
  const actionable = rows.filter((row) => row.requestType !== 'Cancellation request')
  const orderGroups = new Map<number, BookingRequestRow[]>()
  const standalone: BookingRequestRow[] = []

  for (const row of actionable) {
    if (
      row.orderId &&
      (row.requestTypes.includes('Hold confirmation') || row.requestTypes.includes('Package purchase'))
    ) {
      const group = orderGroups.get(row.orderId) ?? []
      group.push(row)
      orderGroups.set(row.orderId, group)
      continue
    }
    standalone.push(row)
  }

  const mergedOrderRows: BookingRequestRow[] = []
  for (const [orderId, group] of orderGroups) {
    const base = group.reduce((acc, row) => mergeBookingRequestRows(acc, row))
    const bookingIds = Array.from(new Set(group.flatMap((row) => row.bookingIds)))
    const bookingCodes = Array.from(new Set(group.flatMap((row) => row.bookingCodes).filter(Boolean)))
    const orderNumber = base.orderNumber || group[0]?.number || `Order #${orderId}`
    mergedOrderRows.push({
      ...base,
      key: `order-${orderId}`,
      orderId,
      orderNumber,
      number: orderNumber,
      bookingId: bookingIds.length ? Math.min(...bookingIds) : 0,
      bookingIds,
      bookingCodes,
      linkedBookingCount: Math.max(bookingIds.length, base.linkedBookingCount),
    })
  }

  const byBookingId = new Map<number, BookingRequestRow>()
  for (const row of [...standalone, ...mergedOrderRows]) {
    const mergeKey = row.orderId && (row.requestTypes.includes('Hold confirmation') || row.requestTypes.includes('Package purchase'))
      ? -row.orderId
      : row.bookingId
    const existing = byBookingId.get(mergeKey)
    if (existing) {
      byBookingId.set(mergeKey, mergeBookingRequestRows(existing, row))
    } else {
      byBookingId.set(mergeKey, row)
    }
  }

  const mergedRows = [...cancellations, ...Array.from(byBookingId.values())]
  const bookingIdsCoveredByOrder = new Set<number>()
  for (const row of mergedRows) {
    if (row.orderId && (row.requestTypes.includes('Hold confirmation') || row.requestTypes.includes('Package purchase'))) {
      row.bookingIds.forEach((id) => bookingIdsCoveredByOrder.add(id))
    }
  }

  return mergedRows
    .filter((row) => {
      if (row.requestTypes.includes('Hold confirmation') && !row.orderId && bookingIdsCoveredByOrder.has(row.bookingId)) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0
      const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0
      return bTime - aTime
    })
}

function bookingRequestTypeLabel(row: BookingRequestRow): string {
  if (row.requestTypes.length <= 1) return row.requestType
  return row.requestTypes.join(' + ')
}

function bookingRequestSubtitle(row: BookingRequestRow): string | null {
  const parts: string[] = []
  if (row.orderId) {
    if (row.linkedBookingCount > 1) {
      parts.push(`${row.linkedBookingCount} bookings`)
    }
  } else if (row.linkedBookingCount > 1) {
    parts.push(`${row.linkedBookingCount} bookings on this order`)
  }
  if (row.requestTypes.length > 1 || row.requestType !== 'Hold confirmation') {
    parts.push(bookingRequestTypeLabel(row))
  }
  if (row.requestTypes.includes('Deposit proof') && row.amount) {
    parts.push(formatMoney(row.amount))
  }
  if (row.requestTypes.includes('Package purchase') && row.amount) {
    parts.push(formatMoney(row.amount))
  }
  return parts.length ? parts.join(' · ') : null
}

function orderHasServicePackage(order: OrderApiItem): boolean {
  if ((order.package_items?.length ?? 0) > 0) return true
  return (order.line_types ?? []).includes('service_package')
}

function shouldShowBookingPackageOrder(order: OrderApiItem): boolean {
  const orderType = order.order_type ?? detectOrderType(order)
  if (orderType !== 'booking' && orderType !== 'mixed') return false
  if (!orderHasServicePackage(order)) return false

  const status = String(order.status ?? '').toLowerCase()
  const payment = String(order.payment_status ?? '').toLowerCase()

  if (status === 'cancelled' || status === 'completed') return false
  if (payment === 'paid' || payment === 'refunded') return false
  if (status === 'reject_payment_proof') return false

  return true
}

function buildPackagePurchaseRequest(order: OrderApiItem): BookingRequestRow {
  const orderId = Number(order.id)
  const orderNo = order.order_no ?? order.order_number ?? `#${orderId}`
  const status = String(order.status ?? '').toLowerCase()
  const payment = String(order.payment_status ?? '').toLowerCase()
  const statusLabel = payment === 'unpaid' && status === 'processing'
    ? 'AWAITING VERIFICATION'
    : payment === 'unpaid'
      ? 'AWAITING PAYMENT'
      : String(order.status ?? 'PENDING').toUpperCase()

  return {
    key: `package-order-${orderId}`,
    id: orderId,
    bookingId: 0,
    bookingIds: [],
    requestType: 'Package purchase',
    requestTypes: ['Package purchase'],
    number: orderNo,
    orderId,
    orderNumber: orderNo,
    bookingCodes: [],
    linkedBookingCount: 0,
    customerName: order.customer?.name || '-',
    contact: order.customer?.phone || order.customer?.email || '-',
    requestedAt: order.created_at ?? null,
    status: statusLabel,
    badgeClassName: 'bg-purple-100 text-purple-800 ring-purple-200',
    amount: Number(order.grand_total ?? 0),
  }
}

function shouldShowEcommerceOrder(order: OrderApiItem): boolean {
  const orderType = order.order_type ?? detectOrderType(order)
  if (orderType !== 'ecommerce') return false

  const status = String(order.status ?? '').toLowerCase()
  const payment = String(order.payment_status ?? '').toLowerCase()

  if (status === 'cancelled' || status === 'completed') return false
  if (status === 'reject_payment_proof') return false
  if (payment === 'refunded' && status === 'cancelled') return false

  return true
}

function buildReturnRequestRow(row: ReturnRequestApiRow): EcommerceRequestRow {
  const returnId = Number(row.id)
  const orderNo = row.order?.order_number ?? (row.order?.id ? `Order #${row.order.id}` : '—')
  const status = normalizeReturnStatus(row.status)

  return {
    key: `return-${returnId}`,
    kind: 'return',
    id: returnId,
    returnId,
    orderId: row.order?.id ? Number(row.order.id) : undefined,
    orderNo,
    customerName: row.customer?.name || '—',
    contact: row.customer?.phone || row.customer?.email || '—',
    createdAt: row.created_at ?? row.timeline?.created_at ?? '',
    statusLabel: formatReturnStatusLabel(status),
    status,
    paymentStatus: '',
    shippingMethod: null,
    requestLabel: 'Return / Refund',
  }
}

function ecommerceRowStatusBadgeClass(row: EcommerceRequestRow): string {
  if (row.kind === 'return') return getReturnStatusPosBadgeClasses(row.status)
  return ecommerceStatusBadgeClass(row.statusLabel)
}

function ecommerceStatusBadgeClass(label: string): string {
  if (label === 'Waiting for Verification') return 'bg-amber-100 text-amber-900 ring-amber-200'
  if (label === 'Payment Confirmed' || label === 'Preparing') return 'bg-blue-100 text-blue-900 ring-blue-200'
  if (label === 'Ready for Pickup' || label === 'Shipped') return 'bg-indigo-100 text-indigo-900 ring-indigo-200'
  if (label === 'Payment Failed') return 'bg-rose-100 text-rose-900 ring-rose-200'
  if (label === 'Awaiting Payment') return 'bg-slate-100 text-slate-800 ring-slate-200'
  return 'bg-slate-100 text-slate-800 ring-slate-200'
}

function extractRows<T>(payload: unknown): T[] {
  const data = (payload as { data?: unknown } | null)?.data
  if (Array.isArray(data)) return data as T[]
  const nested = (data as { data?: unknown } | null)?.data
  return Array.isArray(nested) ? (nested as T[]) : []
}

function fmtDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function buildCancellationRequest(row: BookingCancellationRequestRow): BookingRequestRow {
  const booking = row.booking
  const customer = booking?.customer
  const bookingId = Number(row.booking_id ?? booking?.id ?? 0)
  const bookingCode = booking?.booking_code || (bookingId > 0 ? `#${bookingId}` : `Request #${row.id}`)

  return {
    key: `cancel-${row.id}`,
    id: row.id,
    requestId: row.id,
    bookingId,
    bookingIds: bookingId > 0 ? [bookingId] : [],
    requestType: 'Cancellation request',
    requestTypes: ['Cancellation request'],
    number: bookingCode,
    bookingCode,
    bookingCodes: bookingCode ? [bookingCode] : [],
    linkedBookingCount: 1,
    customerName: customer?.name || booking?.guest_name || 'Guest',
    contact: customer?.phone || booking?.guest_phone || customer?.email || booking?.guest_email || '-',
    requestedAt: row.requested_at ?? row.created_at ?? null,
    status: row.status ?? 'pending',
    badgeClassName: 'bg-rose-100 text-rose-800 ring-rose-200',
    reason: row.reason ?? null,
    adminNote: row.admin_note ?? null,
  }
}

function formatMoney(value?: string | number | null) {
  return `RM ${Number(value ?? 0).toFixed(2)}`
}

function PackageBadge({ name }: { name: string }) {
  return (
    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
      [PKG] {name}
    </span>
  )
}

function calcDurationMinutes(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value || '—'}</p>
    </div>
  )
}

function buildHoldRequest(row: BookingHoldRow): BookingRequestRow {
  const holdOrder = row.hold_deposit_order
  const linkedBookings = row.hold_linked_bookings ?? []
  const bookingCode = row.booking_code || `#${row.id}`
  const orderNumber = holdOrder?.order_number
  const linkedBookingCount = Math.max(linkedBookings.length, 1)

  return {
    key: holdOrder?.id ? `hold-order-${holdOrder.id}-${row.id}` : `hold-${row.id}`,
    id: row.id,
    bookingId: row.id,
    bookingIds: linkedBookings.length ? linkedBookings.map((item) => item.id) : [row.id],
    requestType: 'Hold confirmation',
    requestTypes: ['Hold confirmation'],
    number: orderNumber || bookingCode,
    orderId: holdOrder?.id,
    orderNumber,
    bookingCode,
    bookingCodes: linkedBookings.length
      ? linkedBookings.map((item) => item.booking_code)
      : [bookingCode],
    linkedBookingCount,
    customerName: row.customer_name || row.guest_name || 'Guest',
    contact: row.customer_phone || row.guest_phone || row.customer_email || row.guest_email || '-',
    requestedAt: row.created_at ?? row.appointment_start_at ?? null,
    status: row.status ?? 'HOLD',
    badgeClassName: 'bg-amber-100 text-amber-800 ring-amber-200',
  }
}

function buildDepositProofRequest(row: PaymentLinkReviewRow): BookingRequestRow {
  const bookingId = Number(row.booking_id ?? 0)
  const bookingCode = row.booking_code || (bookingId > 0 ? `#${bookingId}` : `Link #${row.id}`)
  return {
    key: `deposit-proof-${row.id}`,
    id: row.id,
    linkId: row.id,
    bookingId,
    bookingIds: bookingId > 0 ? [bookingId] : [],
    requestType: 'Deposit proof',
    requestTypes: ['Deposit proof'],
    number: bookingCode,
    bookingCode,
    bookingCodes: bookingCode ? [bookingCode] : [],
    linkedBookingCount: 1,
    customerName: row.customer_name || 'Guest',
    contact: row.customer_contact || '-',
    requestedAt: row.slip_uploaded_at ?? null,
    status: 'PROOF UPLOADED',
    badgeClassName: 'bg-blue-100 text-blue-800 ring-blue-200',
    amount: Number(row.amount ?? 0),
    slipUrl: row.manual_slip_url ?? null,
  }
}

export default function PosRequestCenter({
  disabled = false,
  disabledTitle,
  canReviewBookingRequests = true,
  onBookingRequestsChanged,
  permissions = [],
}: PosRequestCenterProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'booking' | 'ecommerce' | 'balance'>('booking')
  const [bookingRows, setBookingRows] = useState<BookingRequestRow[]>([])
  const [ecommerceRows, setEcommerceRows] = useState<EcommerceRequestRow[]>([])
  const [balanceRows, setBalanceRows] = useState<BalanceTopupRow[]>([])
  const [viewingBalanceTopup, setViewingBalanceTopup] = useState<BalanceTopupRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingConfirm, setBookingConfirm] = useState<BookingConfirmState>(null)
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewingBooking, setViewingBooking] = useState<BookingRequestRow | null>(null)
  const [bookingDetail, setBookingDetail] = useState<PosAppointmentDetail | null>(null)
  const [bookingDetailLoading, setBookingDetailLoading] = useState(false)
  const [bookingDetailError, setBookingDetailError] = useState<string | null>(null)
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null)
  const [viewingReturnId, setViewingReturnId] = useState<number | null>(null)
  const loadGenerationRef = useRef(0)

  const canVerifyTopups = permissions.includes('customer_wallet.verify_topup') || permissions.includes('customer_wallet.adjust')
  const totalCount = bookingRows.length + ecommerceRows.length + balanceRows.length

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    setLoading(true)
    setError(null)

    try {
      const depositProofPromise = fetch('/api/proxy/pos/payment-links/pending-review', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
      const balanceTopupPromise = fetch('/api/proxy/admin/customer-wallet/topups/pending?per_page=50', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)

      const [cancellationRes, ...remainingResponses] = await Promise.all([
        fetch('/api/proxy/pos/cancellation-requests?status=pending&per_page=50', { cache: 'no-store' }),
        ...BOOKING_HOLD_FILTERS.map((status) => {
          const qs = new URLSearchParams({ status, per_page: '50' })
          return fetch(`/api/proxy/pos/appointments?${qs.toString()}`, { cache: 'no-store' })
        }),
        ...BOOKING_PACKAGE_ORDER_FILTERS.map((filter) => {
          const qs = new URLSearchParams({ per_page: '25', order_type: 'booking' })
          if (filter.status) qs.set('status', filter.status)
          if (filter.payment_status) qs.set('payment_status', filter.payment_status)
          return fetch(`/api/proxy/ecommerce/orders?${qs.toString()}`, { cache: 'no-store' })
        }),
        ...ECOMMERCE_REQUEST_FILTERS.map((filter) => {
          const qs = new URLSearchParams({ per_page: '25', order_type: 'ecommerce' })
          if (filter.status) qs.set('status', filter.status)
          if (filter.payment_status) qs.set('payment_status', filter.payment_status)
          return fetch(`/api/proxy/ecommerce/orders?${qs.toString()}`, { cache: 'no-store' })
        }),
        ...RETURN_REQUEST_ACTIVE_STATUSES.map((status) => {
          const qs = new URLSearchParams({ per_page: '25', status })
          return fetch(`/api/proxy/ecommerce/returns?${qs.toString()}`, { cache: 'no-store' })
        }),
      ])

      const holdResponses = remainingResponses.slice(0, BOOKING_HOLD_FILTERS.length)
      const bookingOrderResponses = remainingResponses.slice(
        BOOKING_HOLD_FILTERS.length,
        BOOKING_HOLD_FILTERS.length + BOOKING_PACKAGE_ORDER_FILTERS.length,
      )
      const orderResponses = remainingResponses.slice(
        BOOKING_HOLD_FILTERS.length + BOOKING_PACKAGE_ORDER_FILTERS.length,
        BOOKING_HOLD_FILTERS.length + BOOKING_PACKAGE_ORDER_FILTERS.length + ECOMMERCE_REQUEST_FILTERS.length,
      )
      const returnResponses = remainingResponses.slice(
        BOOKING_HOLD_FILTERS.length + BOOKING_PACKAGE_ORDER_FILTERS.length + ECOMMERCE_REQUEST_FILTERS.length,
      )

      const cancellationPayload = await cancellationRes.json().catch(() => null)
      if (!cancellationRes.ok) {
        throw new Error(String(cancellationPayload?.message ?? 'Failed to load booking requests.'))
      }

      const cancellationRequests = extractRows<BookingCancellationRequestRow>(cancellationPayload).map(buildCancellationRequest)
      const holdPayloads = await Promise.all(holdResponses.map((res) => res.json().catch(() => null)))
      const holdRowsRaw = holdPayloads
        .flatMap((payload) => extractRows<BookingHoldRow>(payload))
        .filter((row) => ['HOLD', 'PENDING', 'PENDING_CONFIRMATION'].includes(String(row.status ?? '').toUpperCase()))
      const holdRowsById = new Map<number, BookingHoldRow>()
      for (const row of holdRowsRaw) {
        const existing = holdRowsById.get(row.id)
        if (!existing) {
          holdRowsById.set(row.id, row)
          continue
        }
        if (row.hold_deposit_order && !existing.hold_deposit_order) {
          holdRowsById.set(row.id, row)
        }
      }
      const holdRequests = Array.from(holdRowsById.values()).map(buildHoldRequest)

      const depositProofPayload = await depositProofPromise
      const depositProofRows = Array.isArray(depositProofPayload?.data?.payment_links)
        ? (depositProofPayload.data.payment_links as PaymentLinkReviewRow[])
        : []
      const depositProofRequests = depositProofRows.map(buildDepositProofRequest)

      const bookingOrderPayloads = await Promise.all(bookingOrderResponses.map((res) => res.json().catch(() => null)))
      const bookingOrders = bookingOrderPayloads.flatMap((payload) => extractRows<OrderApiItem>(payload))
      const uniqueBookingOrders = Array.from(new Map(bookingOrders.map((order) => [Number(order.id), order])).values())
      const packagePurchaseRequests = uniqueBookingOrders
        .filter(shouldShowBookingPackageOrder)
        .map(buildPackagePurchaseRequest)

      const nextBookingRows = consolidateBookingRequests(
        enrichHoldRowsWithSharedOrder(
          dedupeByKey([...cancellationRequests, ...holdRequests, ...depositProofRequests, ...packagePurchaseRequests]),
        ),
      )

      const orderPayloads = await Promise.all(orderResponses.map((res) => res.json().catch(() => null)))
      const orders = orderPayloads.flatMap((payload) => extractRows<OrderApiItem>(payload))
      const uniqueOrders = Array.from(new Map(orders.map((order) => [Number(order.id), order])).values())
      const ecommerceOrderRows: EcommerceRequestRow[] = uniqueOrders
        .filter(shouldShowEcommerceOrder)
        .map((order) => {
          const orderType = order.order_type ?? detectOrderType(order)
          const orderId = Number(order.id)
          return {
            key: `order-${orderId}`,
            kind: 'order' as const,
            id: orderId,
            orderId,
            orderNo: order.order_no ?? order.order_number ?? `#${orderId}`,
            customerName: order.customer?.name || '-',
            contact: order.customer?.phone || order.customer?.email || '-',
            createdAt: order.created_at ?? '',
            statusLabel: calculateOrderStatus(order.status, order.payment_status, orderType),
            status: order.status ?? '',
            paymentStatus: order.payment_status ?? '',
            shippingMethod: order.shipping_method ?? null,
          }
        })

      const returnPayloads = await Promise.all(returnResponses.map((res) => res.json().catch(() => null)))
      const returnItems = returnPayloads.flatMap((payload) => extractRows<ReturnRequestApiRow>(payload))
      const uniqueReturns = Array.from(new Map(returnItems.map((row) => [Number(row.id), row])).values())
      const returnRows = uniqueReturns
        .filter((row) => isActiveReturnStatus(row.status))
        .map(buildReturnRequestRow)

      const nextEcommerceRows = [...ecommerceOrderRows, ...returnRows].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bTime - aTime
      })

      if (generation !== loadGenerationRef.current) return

      setBookingRows(nextBookingRows)
      setEcommerceRows(nextEcommerceRows)
      const balancePayload = await balanceTopupPromise
      const balancePage = balancePayload?.data?.topups
      const topups = Array.isArray(balancePage?.data) ? balancePage.data as BalanceTopupRow[] : []
      setBalanceRows(topups)
    } catch (err) {
      if (generation !== loadGenerationRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const summaryCards = useMemo(() => [
    { label: 'Booking requests', value: bookingRows.length, className: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Ecommerce requests', value: ecommerceRows.length, className: 'border-blue-200 bg-blue-50 text-blue-900' },
    { label: 'Balance Top Ups', value: balanceRows.length, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Total pending', value: totalCount, className: 'border-slate-200 bg-slate-50 text-slate-900' },
  ], [bookingRows.length, ecommerceRows.length, balanceRows.length, totalCount])

  const openBookingRowDetail = (row: BookingRequestRow) => {
    if (row.bookingId <= 0 && row.orderId) {
      openOrderView(row)
      return
    }
    if (row.bookingId > 0) {
      void openBookingReview(row)
    }
  }

  const openBookingReview = async (row: BookingRequestRow) => {
    if (row.bookingId <= 0) return
    setViewingOrderId(null)
    setViewingReturnId(null)
    setViewingBooking(row)
    setBookingDetail(null)
    setBookingDetailError(null)
    setBookingDetailLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${row.bookingId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String(json?.message ?? 'Unable to load booking detail.'))
      setBookingDetail((json?.data ?? null) as PosAppointmentDetail | null)
    } catch (err) {
      setBookingDetailError(err instanceof Error ? err.message : 'Unable to load booking detail.')
    } finally {
      setBookingDetailLoading(false)
    }
  }

  const openOrderView = (row: BookingRequestRow) => {
    if (!row.orderId) {
      void openBookingReview(row)
      return
    }
    setViewingBooking(null)
    setBookingDetail(null)
    setBookingDetailError(null)
    setViewingReturnId(null)
    setViewingOrderId(row.orderId)
  }

  const closeBookingDetail = () => {
    setViewingBooking(null)
    setViewingOrderId(null)
    setViewingReturnId(null)
    setBookingDetail(null)
    setBookingDetailError(null)
  }


  const renderViewAction = (onClick: () => void, label: string) => (
    <div className="flex justify-end">
      <button type="button" onClick={onClick} className={BTN_ICON} aria-label={label} title={label}>
        <ViewEyeIcon />
      </button>
    </div>
  )

  const renderBookingActions = (row: BookingRequestRow) => {
    if (row.bookingId <= 0 && !row.orderId) return null
    return renderViewAction(
      () => openOrderView(row),
      row.orderId ? `View order ${row.orderNumber ?? row.number}` : `View booking ${row.number}`,
    )
  }

  const renderEcommerceActions = (row: EcommerceRequestRow) =>
    renderViewAction(
      () => {
        if (row.kind === 'return' && row.returnId) {
          setViewingBooking(null)
          setViewingOrderId(null)
          setViewingReturnId(row.returnId)
          return
        }
        setViewingReturnId(null)
        setViewingOrderId(row.id)
      },
      row.kind === 'return' ? `View return ${row.orderNo}` : `View order ${row.orderNo}`,
    )

  const submitBookingReview = async () => {
    if (!bookingConfirm) return
    setSubmitting(true)
    setError(null)

    try {
      const url = bookingConfirm.kind === 'cancellation'
        ? `/api/proxy/pos/cancellation-requests/${bookingConfirm.row.requestId}/${bookingConfirm.action}`
        : bookingConfirm.kind === 'deposit_proof'
          ? `/api/proxy/pos/appointments/${bookingConfirm.row.bookingId}/payment-links/${bookingConfirm.row.linkId}/${bookingConfirm.action === 'approve' ? 'approve' : 'reject-proof'}`
          : `/api/proxy/pos/appointments/${bookingConfirm.row.bookingId}/${bookingConfirm.action === 'approve' ? 'approve-hold' : 'cancel-hold'}`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: adminNote.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String(json?.message ?? 'Unable to review request.'))

      setBookingConfirm(null)
      setAdminNote('')
      await load()
      await onBookingRequestsChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to review request.')
    } finally {
      setSubmitting(false)
    }
  }

  const detailStackOpen = viewingBooking !== null || viewingOrderId !== null || viewingReturnId !== null || viewingBalanceTopup !== null
  const confirmStackOpen = bookingConfirm !== null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabledTitle}
        className="relative inline-flex items-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={totalCount > 0 ? `Requests, ${totalCount} pending` : 'Requests'}
      >
        Requests
        {totalCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </button>

      {renderPosBodyModalPortal(
        open ? (
        <div className={`pos-body-stack-modal flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4${detailStackOpen || confirmStackOpen ? ' pointer-events-none' : ''}`}>
          <div className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300/90">Request Center</p>
                  <h3 className="mt-1 text-xl font-bold sm:text-2xl">Pending Tasks</h3>
                  <p className="mt-1 text-sm text-slate-300">Booking, ecommerce, returns, and customer balance top-up requests that need staff action.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-slate-200 hover:bg-white/10 hover:text-white" aria-label="Close Request Center">×</button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className={`rounded-xl border px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 ${card.className}`}>
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-75 sm:text-xs">{card.label}</p>
                    <p className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-slate-200 bg-white px-3 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:rounded-none sm:bg-transparent sm:p-0">
                  {(['booking', 'ecommerce', 'balance'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold transition sm:mr-2 sm:flex-none sm:rounded-t-xl sm:border sm:border-b-0 sm:px-5 sm:text-sm ${
                        tab === key
                          ? 'bg-white text-slate-950 shadow-sm sm:border-slate-200 sm:bg-slate-100 sm:shadow-none'
                          : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 sm:border-transparent sm:hover:bg-slate-50'
                      }`}
                    >
                      {key === 'booking' ? `Booking (${bookingRows.length})` : key === 'ecommerce' ? `Ecommerce (${ecommerceRows.length})` : `Balance Top Ups (${balanceRows.length})`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className={`${BTN_ICON} shrink-0 border-slate-200 text-slate-500 sm:h-10 sm:w-10`}
                  aria-label="Refresh requests"
                  title="Refresh"
                >
                  <RefreshIcon className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                </button>
              </div>
            </div>

            <div key={tab} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 p-3 sm:p-6">
              {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
              {loading && totalCount === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Loading requests…</div>
              ) : tab === 'balance' ? (
                balanceRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No pending balance top-ups.</div>
                ) : (
                  <div className="space-y-3">{balanceRows.map((row) => { const proof = row.metadata?.payment_proof_url; return <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-bold text-slate-950">{row.transaction_no} · {formatMoney(row.amount)}</p><p className="mt-1 text-sm text-slate-600">{row.customer?.name || '-'} · {row.customer?.phone || row.customer?.email || '-'}</p><p className="mt-1 text-xs text-slate-500">{row.workspace_type || '-'} · {row.payment_method_label || '-'} · Submitted {fmtDateTime(row.created_at)}</p><p className="mt-1 text-xs font-semibold text-slate-700">Payment proof: {proof ? 'Submitted' : 'Not uploaded'} · Current wallet balance {formatMoney(row.customer?.wallet_balance)}</p></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold" onClick={() => setViewingBalanceTopup(row)}>View Details</button>{canVerifyTopups ? <><button type="button" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={async () => { const res = await fetch(`/api/proxy/admin/customers/${row.customer?.id}/wallet/transactions/${row.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ remark: 'Approved from Request Center' }) }); if (!res.ok) { const json = await res.json().catch(() => null); setError(String(json?.message ?? 'Approve failed.')); return } await load() }}>Approve</button><button type="button" className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={async () => { const reason = window.prompt('Reject reason?'); if (!reason) return; const res = await fetch(`/api/proxy/admin/customers/${row.customer?.id}/wallet/transactions/${row.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ remark: reason }) }); if (!res.ok) { const json = await res.json().catch(() => null); setError(String(json?.message ?? 'Reject failed.')); return } await load() }}>Reject</button></> : null}</div></div></div> })}</div>
                )
              ) : tab === 'booking' ? (
                bookingRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No pending booking requests.</div>
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                      <table className="w-full table-fixed text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="w-[20%] px-4 py-3">Order</th>
                            <th className="w-[24%] px-4 py-3">Customer</th>
                            <th className="w-[22%] px-4 py-3">Requested</th>
                            <th className="w-[18%] px-4 py-3">Status</th>
                            <th className="w-[16%] px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {bookingRows.map((row) => (
                            <tr key={row.key} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 align-top">
                                <button
                                  type="button"
                                  onClick={() => openBookingRowDetail(row)}
                                  className="block max-w-full truncate text-left font-bold text-slate-950 hover:text-amber-700"
                                  title={row.number}
                                >
                                  {row.number}
                                </button>
                                {bookingRequestSubtitle(row) ? (
                                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500" title={bookingRequestSubtitle(row) ?? undefined}>
                                    {bookingRequestSubtitle(row)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <p className="truncate font-semibold text-slate-900" title={row.customerName}>{row.customerName}</p>
                                <p className="truncate text-xs text-slate-500" title={row.contact}>{row.contact}</p>
                              </td>
                              <td className="px-4 py-3 align-top text-slate-600">{fmtDateTime(row.requestedAt)}</td>
                              <td className="px-4 py-3 align-top">
                                <span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase text-slate-700" title={row.status}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top">{renderBookingActions(row)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {bookingRows.map((row) => (
                        <article key={row.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => openBookingRowDetail(row)}
                                className="block max-w-full truncate text-left text-base font-bold text-slate-950 hover:text-amber-700"
                                title={row.number}
                              >
                                {row.number}
                              </button>
                              {bookingRequestSubtitle(row) ? (
                                <p className="mt-0.5 truncate text-[11px] text-slate-500" title={bookingRequestSubtitle(row) ?? undefined}>
                                  {bookingRequestSubtitle(row)}
                                </p>
                              ) : null}
                            </div>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{row.status}</span>
                          </div>
                          <dl className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                              <dt className="font-semibold text-slate-500">Customer</dt>
                              <dd className="max-w-[60%] truncate text-right font-medium text-slate-900" title={row.customerName}>{row.customerName}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Requested</dt>
                              <dd className="text-right text-slate-700">{fmtDateTime(row.requestedAt)}</dd>
                            </div>
                          </dl>
                          <div className="mt-4 border-t border-slate-100 pt-4">{renderBookingActions(row)}</div>
                        </article>
                      ))}
                    </div>
                  </>
                )
              ) : ecommerceRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No pending ecommerce orders or return/refund requests.</div>
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-[20%] px-4 py-3">Order</th>
                          <th className="w-[24%] px-4 py-3">Customer</th>
                          <th className="w-[22%] px-4 py-3">Created</th>
                          <th className="w-[18%] px-4 py-3">Status</th>
                          <th className="w-[16%] px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ecommerceRows.map((row) => (
                          <tr key={row.key} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 align-top">
                              <p className="truncate font-bold text-slate-950" title={row.orderNo}>{row.orderNo}</p>
                              {row.kind === 'return' && row.requestLabel ? (
                                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-violet-700" title={row.requestLabel}>
                                  {row.requestLabel}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <p className="truncate font-semibold text-slate-900" title={row.customerName}>{row.customerName}</p>
                              <p className="truncate text-xs text-slate-500" title={row.contact}>{row.contact}</p>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-600">{fmtDateTime(row.createdAt)}</td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${ecommerceRowStatusBadgeClass(row)}`}
                                title={row.statusLabel}
                              >
                                {row.statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">{renderEcommerceActions(row)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {ecommerceRows.map((row) => (
                      <article key={row.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold text-slate-950" title={row.orderNo}>{row.orderNo}</p>
                            {row.kind === 'return' && row.requestLabel ? (
                              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">{row.requestLabel}</p>
                            ) : null}
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${ecommerceRowStatusBadgeClass(row)}`}>
                            {row.statusLabel}
                          </span>
                        </div>
                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
                            <dt className="font-semibold text-slate-500">Customer</dt>
                            <dd className="max-w-[60%] truncate text-right font-medium text-slate-900" title={row.customerName}>{row.customerName}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="font-semibold text-slate-500">Created</dt>
                            <dd className="text-right text-slate-700">{fmtDateTime(row.createdAt)}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 border-t border-slate-100 pt-4">{renderEcommerceActions(row)}</div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null)}

      {renderPosBodyModalPortal(
        bookingConfirm ? (
        <div className="pos-body-stack-modal-top flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              {bookingConfirm.kind === 'hold'
                ? (bookingConfirm.action === 'approve' ? 'Confirm booking?' : 'Reject / cancel booking?')
                : bookingConfirm.kind === 'deposit_proof'
                  ? (bookingConfirm.action === 'approve' ? 'Confirm deposit payment?' : 'Reject payment proof?')
                  : (bookingConfirm.action === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {bookingConfirm.row.number} · {bookingConfirm.row.customerName}
              {bookingConfirm.row.linkedBookingCount > 1 ? (
                <span className="block text-xs text-slate-500">
                  Approving confirms {bookingConfirm.row.linkedBookingCount} linked booking(s) on this deposit order.
                </span>
              ) : null}
            </p>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="mt-4 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Admin note (optional)" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setBookingConfirm(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={submitting} onClick={() => void submitBookingReview()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      ) : null)}

      {renderPosBodyModalPortal(
        viewingBooking && viewingOrderId === null ? (
        <div className={`pos-body-stack-modal-detail flex items-center justify-end bg-slate-950/50${confirmStackOpen ? ' pointer-events-none' : ''}`} role="dialog" aria-modal="true">
          <aside className="pointer-events-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                    {viewingBooking.orderNumber ? 'Order review' : 'Booking detail'}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-950">
                    {viewingBooking.orderNumber ?? bookingDetail?.booking_code ?? viewingBooking.number}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {bookingRequestTypeLabel(viewingBooking)} · requested {fmtDateTime(viewingBooking.requestedAt)}
                  </p>
                  {viewingBooking.orderId ? (
                    <button
                      type="button"
                      onClick={() => setViewingOrderId(viewingBooking.orderId!)}
                      className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      View full order {viewingBooking.orderNumber}
                    </button>
                  ) : null}
                </div>
                <button type="button" onClick={closeBookingDetail} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close booking detail">×</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              {bookingDetailLoading ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading booking detail...</p> : null}
              {bookingDetailError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{bookingDetailError}</p> : null}
              {bookingDetail ? (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Booking Info</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Info label="Booking number" value={bookingDetail.booking_code ?? viewingBooking.number} />
                      <Info label="Booking status" value={bookingDetail.status ?? viewingBooking.status} />
                      <Info label="Payment status" value={bookingDetail.payment_status ?? '—'} />
                      <Info label="Created time" value={fmtDateTime((bookingDetail as { created_at?: string | null }).created_at)} />
                      <Info label="Request type" value={bookingRequestTypeLabel(viewingBooking)} />
                      <Info label="Request created time" value={fmtDateTime(viewingBooking.requestedAt)} />
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer / Guest</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-3">
                      <Info label="Name" value={bookingDetail.customer?.name ?? bookingDetail.customer_name ?? bookingDetail.guest_name ?? viewingBooking.customerName} />
                      <Info label="Phone" value={bookingDetail.customer?.phone ?? bookingDetail.customer_phone ?? bookingDetail.guest_phone ?? '—'} />
                      <Info label="Email" value={bookingDetail.customer?.email ?? bookingDetail.customer_email ?? bookingDetail.guest_email ?? '—'} />
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Services</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      {(() => {
                        const activeClaims = (bookingDetail.package_claims ?? []).filter((claim) => ['reserved', 'consumed'].includes(String(claim.status)))
                        const claimForService = (serviceId?: number | null) => activeClaims.find((claim) => Number(claim.booking_service_id) === Number(serviceId ?? 0))
                        const mainRows: Array<{ id?: number | null; name: string; cn_name?: string | null; linked_booking_service_id?: number | null }> = bookingDetail.main_services?.length
                          ? bookingDetail.main_services
                          : bookingDetail.service
                            ? [{ id: bookingDetail.service.id, name: bookingDetail.service.name, cn_name: bookingDetail.service.cn_name, linked_booking_service_id: bookingDetail.service.id }]
                            : []
                        const packageUsageRows = [
                          ...mainRows.map((item) => {
                            const claim = claimForService(item.linked_booking_service_id ?? item.id)
                            return claim ? { key: `main-${item.id ?? item.name}`, packageName: claim.package_name, lineName: 'Main Service Covered' } : null
                          }),
                          ...(bookingDetail.add_ons ?? []).map((item) => {
                            const claim = claimForService(item.linked_booking_service_id)
                            return claim ? { key: `addon-${item.id ?? item.name}`, packageName: claim.package_name, lineName: `${item.name} Covered` } : null
                          }),
                        ].filter(Boolean) as Array<{ key: string; packageName: string; lineName: string }>
                        const mainCovered = mainRows.some((item) => Boolean(claimForService(item.linked_booking_service_id ?? item.id)))
                        const addonCovered = (bookingDetail.add_ons ?? []).some((item) => Boolean(claimForService(item.linked_booking_service_id)))

                        return (
                          <>
                            <div>
                              <span className="font-semibold text-slate-900">Main service(s):</span>
                              <div className="mt-1 space-y-1">
                                {mainRows.length ? mainRows.map((item) => {
                                  const claim = claimForService(item.linked_booking_service_id ?? item.id)
                                  return (
                                    <div key={`main-${item.id ?? item.name}`} className="flex flex-col">
                                      <span>{item.name}</span>
                                      {claim ? <PackageBadge name={claim.package_name} /> : null}
                                    </div>
                                  )
                                }) : '—'}
                              </div>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900">Add-ons:</span>
                              <div className="mt-1 space-y-1">
                                {bookingDetail.add_ons?.length ? bookingDetail.add_ons.map((item) => {
                                  const claim = claimForService(item.linked_booking_service_id)
                                  return (
                                    <div key={`addon-${item.id ?? item.name}`} className="flex flex-col">
                                      <span>{item.name}</span>
                                      {claim ? <PackageBadge name={claim.package_name} /> : null}
                                    </div>
                                  )
                                }) : '—'}
                              </div>
                            </div>
                            {packageUsageRows.length > 0 ? (
                              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Package Usage</p>
                                <div className="mt-2 space-y-1.5">
                                  {packageUsageRows.map((row) => (
                                    <div key={row.key} className="text-xs text-emerald-900">✓ <span className="font-semibold">{row.packageName}</span> · {row.lineName}</div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div><Info label="Service amount" value={formatMoney(bookingDetail.service_total)} />{mainCovered ? <p className="mt-1 text-xs font-semibold text-emerald-700">Covered by package</p> : null}</div>
                              <div><Info label="Add-on amount" value={formatMoney(bookingDetail.addon_total_price)} />{addonCovered ? <p className="mt-1 text-xs font-semibold text-emerald-700">Covered by package</p> : null}</div>
                              <Info label="Total amount" value={formatMoney(Number(bookingDetail.service_total ?? 0) + Number(bookingDetail.addon_total_price ?? 0))} />
                              <Info label="Deposit paid" value={formatMoney(bookingDetail.deposit_paid ?? bookingDetail.deposit_contribution)} />
                              <Info label="Settlement paid" value={formatMoney(bookingDetail.settlement_paid)} />
                              <Info label="Balance due" value={formatMoney(bookingDetail.amount_due_now ?? bookingDetail.balance_due)} />
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Staff / Schedule</p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Info label="Staff" value={bookingDetail.staff_splits?.length ? bookingDetail.staff_splits.map((split) => `${split.staff_name} ${split.share_percent}%`).join(', ') : bookingDetail.staff?.name ?? '—'} />
                      <Info label="Appointment start/end" value={`${fmtDateTime(bookingDetail.appointment_start_at)}${bookingDetail.appointment_end_at ? ` - ${fmtDateTime(bookingDetail.appointment_end_at)}` : ''}`} />
                      <Info label="Duration" value={calcDurationMinutes(bookingDetail.appointment_start_at, bookingDetail.appointment_end_at) != null ? `${calcDurationMinutes(bookingDetail.appointment_start_at, bookingDetail.appointment_end_at)} min` : bookingDetail.estimated_duration_min ? `${bookingDetail.estimated_duration_min} min` : '—'} />
                    </div>
                  </section>
                  {viewingBooking.requestTypes.includes('Deposit proof') ? (
                    <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Deposit Payment Link · Uploaded Proof</p>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <Info label="Deposit amount" value={formatMoney(viewingBooking.amount)} />
                        <Info label="Slip uploaded" value={fmtDateTime(viewingBooking.requestedAt)} />
                      </div>
                      {viewingBooking.slipUrl ? (
                        <a href={viewingBooking.slipUrl} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-blue-200">
                          <img src={viewingBooking.slipUrl} alt="Deposit payment proof" className="max-h-72 w-full object-contain bg-white" />
                        </a>
                      ) : <p className="mt-3 text-sm text-slate-500">No slip file available.</p>}
                    </section>
                  ) : null}
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment Proof / Uploaded Proof</p>
                    {bookingDetail.payment_proofs?.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{bookingDetail.payment_proofs.map((proof, idx) => { const proofUrl = proof.file_url ?? proof.url ?? proof.payment_proof_url; return <div key={`${proof.id ?? idx}`} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-semibold text-slate-900">Proof {idx + 1}</p>{proofUrl ? <a href={proofUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg border border-slate-200"><img src={proofUrl} alt={`Payment proof ${idx + 1}`} className="max-h-56 w-full object-cover" /></a> : null}<p className="mt-2 text-slate-600">{proof.note ?? 'No note'}</p><p className="text-xs text-slate-500">{fmtDateTime(proof.uploaded_at)}</p></div> })}</div> : <p className="mt-3 text-sm text-slate-500">No uploaded payment proof.</p>}
                  </section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes / Remarks</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold text-slate-900">Customer remarks:</span> {bookingDetail.notes || '—'}</p>
                      <p><span className="font-semibold text-slate-900">Payment proof notes:</span> {bookingDetail.payment_proofs?.map((proof) => proof.note).filter(Boolean).join('; ') || '—'}</p>
                      <p><span className="font-semibold text-slate-900">Admin note:</span> {viewingBooking.adminNote || '—'}</p>
                      <p><span className="font-semibold text-slate-900">Cancellation reason:</span> {viewingBooking.reason || '—'}</p>
                      <p><span className="font-semibold text-slate-900">Reschedule reason:</span> {bookingDetail.reschedule_reason || '—'}</p>
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              {canReviewBookingRequests && viewingBooking.requestTypes.includes('Cancellation request') ? <><button type="button" onClick={() => setBookingConfirm({ kind: 'cancellation', row: viewingBooking, action: 'approve' })} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Approve</button><button type="button" onClick={() => setBookingConfirm({ kind: 'cancellation', row: viewingBooking, action: 'reject' })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Reject</button></> : null}
              {canReviewBookingRequests && viewingBooking.requestTypes.includes('Hold confirmation') ? <><button type="button" onClick={() => setBookingConfirm({ kind: 'hold', row: viewingBooking, action: 'approve' })} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Confirm booking</button><button type="button" onClick={() => setBookingConfirm({ kind: 'hold', row: viewingBooking, action: 'reject' })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Reject</button></> : null}
              {canReviewBookingRequests && viewingBooking.requestTypes.includes('Deposit proof') ? <><button type="button" onClick={() => setBookingConfirm({ kind: 'deposit_proof', row: viewingBooking, action: 'approve' })} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Confirm deposit</button><button type="button" onClick={() => setBookingConfirm({ kind: 'deposit_proof', row: viewingBooking, action: 'reject' })} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Reject proof</button></> : null}
              <button type="button" onClick={closeBookingDetail} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Close</button>
            </div>
          </aside>
        </div>
      ) : null)}

      {renderPosBodyModalPortal(
        viewingOrderId !== null ? (
          <OrderViewPanel
            key={viewingOrderId}
            orderId={viewingOrderId}
            onClose={() => {
              setViewingOrderId(null)
              setViewingBooking(null)
            }}
            onOrderUpdated={() => void load()}
            zIndexClassName="pos-body-stack-modal-detail"
          />
        ) : null,
      )}

      {renderPosBodyModalPortal(
        viewingReturnId !== null ? (
          <ReturnViewPanel
            key={viewingReturnId}
            returnId={viewingReturnId}
            onClose={() => setViewingReturnId(null)}
            onReturnUpdated={() => void load()}
            zIndexClassName="pos-body-stack-modal-detail"
          />
        ) : null,
      )}
    </>
  )
}
