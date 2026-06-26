'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import OrderConfirmPaymentModal from '@/components/OrderConfirmPaymentModal'
import OrderRejectPaymentModal from '@/components/OrderRejectPaymentModal'
import OrderViewPanel from '@/components/OrderViewPanel'
import { calculateOrderStatus, type OrderApiItem } from '@/components/orderUtils'

export type PosRequestCenterProps = {
  disabled?: boolean
  disabledTitle?: string
  canReviewBookingRequests?: boolean
  onViewBooking?: (bookingId: number) => void | Promise<void>
  onBookingRequestsChanged?: () => void | Promise<void>
}

type BookingCancellationRequestRow = {
  id: number
  booking_id?: number | null
  requested_at?: string | null
  created_at?: string | null
  status?: string | null
  reason?: string | null
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
}

type BookingRequestRow = {
  key: string
  id: number
  bookingId: number
  requestId?: number
  requestType: 'Cancellation request' | 'Hold confirmation'
  number: string
  customerName: string
  contact: string
  requestedAt: string | null
  status: string
  badgeClassName: string
}

type EcommerceRequestRow = {
  id: number
  orderNo: string
  customerName: string
  contact: string
  createdAt: string
  statusLabel: string
  status: string
  paymentStatus: string
}

type BookingConfirmState =
  | { kind: 'cancellation'; row: BookingRequestRow; action: 'approve' | 'reject' }
  | { kind: 'hold'; row: BookingRequestRow; action: 'approve' | 'reject' }
  | null

const ECOMMERCE_REQUEST_FILTERS = [
  { status: 'pending', payment_status: 'unpaid' },
  { status: 'processing', payment_status: 'unpaid' },
  { status: 'reject_payment_proof', payment_status: 'unpaid' },
  { payment_status: 'failed' },
  { status: 'cancelled' },
]

const BOOKING_HOLD_FILTERS = ['HOLD', 'PENDING']

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

  return {
    key: `cancel-${row.id}`,
    id: row.id,
    requestId: row.id,
    bookingId,
    requestType: 'Cancellation request',
    number: booking?.booking_code || (bookingId > 0 ? `#${bookingId}` : `Request #${row.id}`),
    customerName: customer?.name || booking?.guest_name || 'Guest',
    contact: customer?.phone || booking?.guest_phone || customer?.email || booking?.guest_email || '-',
    requestedAt: row.requested_at ?? row.created_at ?? null,
    status: row.status ?? 'pending',
    badgeClassName: 'bg-rose-100 text-rose-800 ring-rose-200',
  }
}

function buildHoldRequest(row: BookingHoldRow): BookingRequestRow {
  return {
    key: `hold-${row.id}`,
    id: row.id,
    bookingId: row.id,
    requestType: 'Hold confirmation',
    number: row.booking_code || `#${row.id}`,
    customerName: row.customer_name || row.guest_name || 'Guest',
    contact: row.customer_phone || row.guest_phone || row.customer_email || row.guest_email || '-',
    requestedAt: row.created_at ?? row.appointment_start_at ?? null,
    status: row.status ?? 'HOLD',
    badgeClassName: 'bg-amber-100 text-amber-800 ring-amber-200',
  }
}

export default function PosRequestCenter({
  disabled = false,
  disabledTitle,
  canReviewBookingRequests = true,
  onViewBooking,
  onBookingRequestsChanged,
}: PosRequestCenterProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'booking' | 'ecommerce'>('booking')
  const [bookingRows, setBookingRows] = useState<BookingRequestRow[]>([])
  const [ecommerceRows, setEcommerceRows] = useState<EcommerceRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingConfirm, setBookingConfirm] = useState<BookingConfirmState>(null)
  const [adminNote, setAdminNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null)
  const [confirmPaymentOrderId, setConfirmPaymentOrderId] = useState<number | null>(null)
  const [rejectPaymentOrderId, setRejectPaymentOrderId] = useState<number | null>(null)

  const totalCount = bookingRows.length + ecommerceRows.length

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [cancellationRes, ...remainingResponses] = await Promise.all([
        fetch('/api/proxy/pos/cancellation-requests?status=pending&per_page=50', { cache: 'no-store' }),
        ...BOOKING_HOLD_FILTERS.map((status) => {
          const qs = new URLSearchParams({ status, per_page: '50' })
          return fetch(`/api/proxy/pos/appointments?${qs.toString()}`, { cache: 'no-store' })
        }),
        ...ECOMMERCE_REQUEST_FILTERS.map((filter) => {
          const qs = new URLSearchParams({ per_page: '25', order_type: 'ecommerce' })
          if (filter.status) qs.set('status', filter.status)
          if (filter.payment_status) qs.set('payment_status', filter.payment_status)
          return fetch(`/api/proxy/ecommerce/orders?${qs.toString()}`, { cache: 'no-store' })
        }),
      ])

      const holdResponses = remainingResponses.slice(0, BOOKING_HOLD_FILTERS.length)
      const orderResponses = remainingResponses.slice(BOOKING_HOLD_FILTERS.length)

      const cancellationPayload = await cancellationRes.json().catch(() => null)
      if (!cancellationRes.ok) {
        throw new Error(String(cancellationPayload?.message ?? 'Failed to load booking requests.'))
      }

      const cancellationRequests = extractRows<BookingCancellationRequestRow>(cancellationPayload).map(buildCancellationRequest)
      const holdPayloads = await Promise.all(holdResponses.map((res) => res.json().catch(() => null)))
      const holdRequests = holdPayloads
        .flatMap((payload) => extractRows<BookingHoldRow>(payload))
        .filter((row) => ['HOLD', 'PENDING', 'PENDING_CONFIRMATION'].includes(String(row.status ?? '').toUpperCase()))
        .map(buildHoldRequest)

      setBookingRows([...cancellationRequests, ...holdRequests])

      const orderPayloads = await Promise.all(orderResponses.map((res) => res.json().catch(() => null)))
      const orders = orderPayloads.flatMap((payload) => extractRows<OrderApiItem>(payload))
      const uniqueOrders = Array.from(new Map(orders.map((order) => [Number(order.id), order])).values())
      setEcommerceRows(uniqueOrders.map((order) => ({
        id: Number(order.id),
        orderNo: order.order_no ?? order.order_number ?? `#${order.id}`,
        customerName: order.customer?.name || '-',
        contact: order.customer?.phone || order.customer?.email || '-',
        createdAt: order.created_at ?? '',
        statusLabel: calculateOrderStatus(order.status, order.payment_status, 'ecommerce'),
        status: order.status ?? '',
        paymentStatus: order.payment_status ?? '',
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { if (open) void load() }, [open, load])

  const summaryCards = useMemo(() => [
    { label: 'Booking requests', value: bookingRows.length, className: 'border-amber-200 bg-amber-50 text-amber-900' },
    { label: 'Ecommerce requests', value: ecommerceRows.length, className: 'border-blue-200 bg-blue-50 text-blue-900' },
    { label: 'Total pending', value: totalCount, className: 'border-slate-200 bg-slate-50 text-slate-900' },
  ], [bookingRows.length, ecommerceRows.length, totalCount])

  const submitBookingReview = async () => {
    if (!bookingConfirm) return
    setSubmitting(true)
    setError(null)

    try {
      const url = bookingConfirm.kind === 'cancellation'
        ? `/api/proxy/pos/cancellation-requests/${bookingConfirm.row.requestId}/${bookingConfirm.action}`
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

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold">Request Center</h3>
                  <p className="mt-1 text-sm text-slate-200">Pending booking and ecommerce requests that need staff action.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-2xl leading-none text-slate-200 hover:bg-white/10 hover:text-white" aria-label="Close Request Center">×</button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className={`rounded-xl border px-4 py-3 shadow-sm ${card.className}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">{card.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-slate-200 bg-white px-6 pt-4">
              {(['booking', 'ecommerce'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`mr-2 rounded-t-xl border border-b-0 px-5 py-2.5 text-sm font-bold transition ${tab === key ? 'border-slate-200 bg-slate-100 text-slate-950' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                >
                  {key === 'booking' ? `Booking (${bookingRows.length})` : `Ecommerce (${ecommerceRows.length})`}
                </button>
              ))}
            </div>

            <div className="max-h-[58vh] overflow-y-auto bg-slate-50 p-6">
              {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
              {loading ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading requests...</p> : tab === 'booking' ? (
                <div className="space-y-3">
                  {bookingRows.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No pending booking requests.</p> : bookingRows.map((row) => (
                    <div key={row.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-center">
                        <div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${row.badgeClassName}`}>{row.requestType}</span>
                          <p className="mt-2 text-base font-bold text-slate-950">{row.number}</p>
                          <p className="text-sm text-slate-600">{row.customerName} · {row.contact}</p>
                        </div>
                        <div className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Requested:</span> {fmtDateTime(row.requestedAt)}</div>
                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">{row.status}</span>
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          {row.bookingId > 0 && onViewBooking ? <button type="button" onClick={() => void onViewBooking(row.bookingId)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View booking</button> : null}
                          {canReviewBookingRequests && row.requestType === 'Cancellation request' ? <><button type="button" onClick={() => setBookingConfirm({ kind: 'cancellation', row, action: 'approve' })} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Approve cancel</button><button type="button" onClick={() => setBookingConfirm({ kind: 'cancellation', row, action: 'reject' })} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Reject cancel</button></> : null}
                          {canReviewBookingRequests && row.requestType === 'Hold confirmation' ? <><button type="button" onClick={() => setBookingConfirm({ kind: 'hold', row, action: 'approve' })} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Confirm booking</button><button type="button" onClick={() => setBookingConfirm({ kind: 'hold', row, action: 'reject' })} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Reject / cancel</button></> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {ecommerceRows.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No pending ecommerce requests.</p> : ecommerceRows.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.8fr_auto] lg:items-center">
                        <div>
                          <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200">{row.statusLabel}</span>
                          <p className="mt-2 text-base font-bold text-slate-950">{row.orderNo}</p>
                          <p className="text-sm text-slate-600">{row.customerName} · {row.contact}</p>
                        </div>
                        <div className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Created:</span> {fmtDateTime(row.createdAt)}</div>
                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">{row.statusLabel}</span>
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          <button type="button" onClick={() => setViewingOrderId(row.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View order</button>
                          {row.statusLabel === 'Waiting for Verification' ? <><button type="button" onClick={() => setConfirmPaymentOrderId(row.id)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Confirm payment</button><button type="button" onClick={() => setRejectPaymentOrderId(row.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Reject payment proof</button></> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Refresh</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {bookingConfirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              {bookingConfirm.kind === 'hold'
                ? (bookingConfirm.action === 'approve' ? 'Confirm booking?' : 'Reject / cancel booking?')
                : (bookingConfirm.action === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?')}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{bookingConfirm.row.number} · {bookingConfirm.row.customerName}</p>
            <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="mt-4 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Admin note (optional)" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setBookingConfirm(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={submitting} onClick={() => void submitBookingReview()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      ) : null}
      {viewingOrderId !== null ? <OrderViewPanel orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} onOrderUpdated={() => void load()} zIndexClassName="z-[90]" /> : null}
      {confirmPaymentOrderId !== null ? <OrderConfirmPaymentModal orderId={confirmPaymentOrderId} onClose={() => setConfirmPaymentOrderId(null)} onSuccess={() => void load()} zIndexClassName="z-[90]" /> : null}
      {rejectPaymentOrderId !== null ? <OrderRejectPaymentModal orderId={rejectPaymentOrderId} onClose={() => setRejectPaymentOrderId(null)} onSuccess={() => void load()} zIndexClassName="z-[90]" /> : null}
    </>
  )
}
