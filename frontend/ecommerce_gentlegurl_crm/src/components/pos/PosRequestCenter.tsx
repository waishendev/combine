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

type BookingRequestRow = {
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

type ConfirmState = { row: BookingRequestRow; action: 'approve' | 'reject' } | null

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

function bookingIdentity(row: BookingRequestRow) {
  const booking = row.booking
  const customer = booking?.customer
  return {
    bookingId: Number(row.booking_id ?? booking?.id ?? 0),
    number: booking?.booking_code || (row.booking_id ? `#${row.booking_id}` : `Request #${row.id}`),
    customerName: customer?.name || booking?.guest_name || 'Guest',
    contact: customer?.phone || booking?.guest_phone || customer?.email || booking?.guest_email || '-',
  }
}

const ECOMMERCE_REQUEST_FILTERS = [
  { status: 'pending', payment_status: 'unpaid' },
  { status: 'processing', payment_status: 'unpaid' },
  { status: 'reject_payment_proof', payment_status: 'unpaid' },
  { payment_status: 'failed' },
  { status: 'cancelled' },
]

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
  const [confirm, setConfirm] = useState<ConfirmState>(null)
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
      const [bookingRes, ...orderResponses] = await Promise.all([
        fetch('/api/proxy/pos/cancellation-requests?status=pending&per_page=50', { cache: 'no-store' }),
        ...ECOMMERCE_REQUEST_FILTERS.map((filter) => {
          const qs = new URLSearchParams({ per_page: '25', order_type: 'ecommerce' })
          if (filter.status) qs.set('status', filter.status)
          if (filter.payment_status) qs.set('payment_status', filter.payment_status)
          return fetch(`/api/proxy/ecommerce/orders?${qs.toString()}`, { cache: 'no-store' })
        }),
      ])

      const bookingPayload = await bookingRes.json().catch(() => null)
      if (!bookingRes.ok) throw new Error(String(bookingPayload?.message ?? 'Failed to load booking requests.'))
      setBookingRows(extractRows<BookingRequestRow>(bookingPayload))

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

  const bookingCountLabel = useMemo(() => bookingRows.length > 99 ? '99+' : String(bookingRows.length), [bookingRows.length])
  const ecommerceCountLabel = useMemo(() => ecommerceRows.length > 99 ? '99+' : String(ecommerceRows.length), [ecommerceRows.length])

  const submitBookingReview = async () => {
    if (!confirm) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/pos/cancellation-requests/${confirm.row.id}/${confirm.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_note: adminNote.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String(json?.message ?? 'Unable to review request.'))
      setConfirm(null)
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
        {totalCount > 0 ? <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white">{totalCount > 99 ? '99+' : totalCount}</span> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div><h3 className="text-lg font-bold text-gray-900">Request Center</h3><p className="text-sm text-gray-500">Pending booking and ecommerce requests that need staff action.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl text-gray-500 hover:text-gray-800">×</button>
            </div>
            <div className="border-b px-5 pt-3">
              {(['booking', 'ecommerce'] as const).map((key) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`mr-2 rounded-t-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-amber-100 text-amber-950' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {key === 'booking' ? `Booking (${bookingCountLabel})` : `Ecommerce (${ecommerceCountLabel})`}
                </button>
              ))}
            </div>
            <div className="max-h-[62vh] overflow-y-auto p-5">
              {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {loading ? <p className="text-sm text-gray-600">Loading requests...</p> : tab === 'booking' ? (
                <div className="space-y-3">
                  {bookingRows.length === 0 ? <p className="text-sm text-gray-600">No pending booking requests.</p> : bookingRows.map((row) => {
                    const info = bookingIdentity(row)
                    return <div key={row.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                        <div><p className="text-xs font-semibold uppercase text-amber-700">Cancellation request</p><p className="font-semibold text-gray-900">{info.number}</p><p className="text-sm text-gray-600">{info.customerName} · {info.contact}</p></div>
                        <div className="text-sm text-gray-600">Requested: {fmtDateTime(row.requested_at ?? row.created_at)}</div>
                        <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{row.status ?? 'pending'}</span>
                        <div className="flex flex-wrap gap-2">
                          {info.bookingId > 0 && onViewBooking ? <button type="button" onClick={() => void onViewBooking(info.bookingId)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">View booking</button> : null}
                          {canReviewBookingRequests ? <><button type="button" onClick={() => setConfirm({ row, action: 'approve' })} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Approve cancel</button><button type="button" onClick={() => setConfirm({ row, action: 'reject' })} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Reject cancel</button></> : null}
                        </div>
                      </div>
                    </div>
                  })}
                  <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">Reschedule and confirmation requests will appear here when those request records are available.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {ecommerceRows.length === 0 ? <p className="text-sm text-gray-600">No pending ecommerce requests.</p> : ecommerceRows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                        <div><p className="text-xs font-semibold uppercase text-blue-700">{row.statusLabel}</p><p className="font-semibold text-gray-900">{row.orderNo}</p><p className="text-sm text-gray-600">{row.customerName} · {row.contact}</p></div>
                        <div className="text-sm text-gray-600">Created: {fmtDateTime(row.createdAt)}</div>
                        <span className="w-fit rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{row.statusLabel}</span>
                        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setViewingOrderId(row.id)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">View order</button>{row.statusLabel === 'Waiting for Verification' ? <><button type="button" onClick={() => setConfirmPaymentOrderId(row.id)} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Confirm payment</button><button type="button" onClick={() => setRejectPaymentOrderId(row.id)} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Reject payment proof</button></> : null}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4"><button type="button" onClick={() => void load()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Refresh</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">Close</button></div>
          </div>
        </div>
      ) : null}

      {confirm ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"><h3 className="text-lg font-bold text-gray-900">{confirm.action === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?'}</h3><textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} className="mt-4 min-h-24 w-full rounded-lg border border-gray-300 p-3 text-sm" placeholder="Admin note (optional)" /><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => setConfirm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={submitting} onClick={() => void submitBookingReview()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white">{submitting ? 'Submitting...' : 'Submit'}</button></div></div></div> : null}
      {viewingOrderId !== null ? <OrderViewPanel orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} onOrderUpdated={() => void load()} zIndexClassName="z-[80]" /> : null}
      {confirmPaymentOrderId !== null ? <OrderConfirmPaymentModal orderId={confirmPaymentOrderId} onClose={() => setConfirmPaymentOrderId(null)} onSuccess={() => void load()} /> : null}
      {rejectPaymentOrderId !== null ? <OrderRejectPaymentModal orderId={rejectPaymentOrderId} onClose={() => setRejectPaymentOrderId(null)} onSuccess={() => void load()} /> : null}
    </>
  )
}
