'use client'

import { useEffect, useMemo, useState } from 'react'

import BookingPhotosPaymentProofSection from '@/components/booking/BookingPhotosPaymentProofSection'
import { type BookingServicePhoto } from '@/components/booking/BookingServicePhotosPanel'
import BookingServicesAddOnsSection, {
  type BookingServiceAddOn,
  type BookingServiceBlock,
} from '@/components/booking/BookingServicesAddOnsSection'
import { type PaymentProof } from '@/components/payment/PaymentProofPreview'
import StatusBadge from '@/components/StatusBadge'
import { getAppointmentDisplayRemarkLines } from '@/components/pos/posAppointmentHelpers'

type Photo = {
  id: number
  file_url?: string | null
  original_name?: string | null
}

type DailyBookingRow = {
  id: number
  booking_code: string
  customer_display_name: string
  guest_name?: string | null
  customer?: { id: number; name: string; phone?: string | null; email?: string | null } | null
  service?: { id: number; name: string; cn_name?: string | null; duration_min?: number | null } | null
  services?: BookingServiceBlock[]
  service_blocks?: BookingServiceBlock[]
  add_ons?: BookingServiceAddOn[]
  staff?: { id: number; name: string } | null
  start_at?: string | null
  end_at?: string | null
  status: string
  payment_status?: string | null
  computed_payment_status?: string | null
  total_amount?: number
  paid_amount?: number
  deposit_paid?: number
  settlement_paid?: number
  package_offset?: number
  balance_due?: number
  customer_reference_photos_count?: number
  customer_reference_photos?: Photo[]
  service_photos_count?: number
  service_photos?: BookingServicePhoto[]
  payment_proofs?: PaymentProof[]
  notes?: string | null
  void_remarks?: string | null
  settlement_notes?: string | null
  reschedule_reason?: string | null
}

type DailyBookingResponse = {
  data?: {
    date?: string
    data?: DailyBookingRow[]
  }
}

const todayYmd = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
}

const formatTimeRange = (start?: string | null, end?: string | null) => {
  if (!start) return '—'
  const startText = new Date(start).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })
  const endText = end ? new Date(end).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' }) : null
  return endText ? `${startText} – ${endText}` : startText
}

const money = (value?: number | null) => `RM ${Number(value ?? 0).toFixed(2)}`

function formatPaymentStatusKey(status?: string | null) {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', ' ')
}

function formatPaymentStatusLabel(status?: string | null) {
  const raw = String(status ?? '').trim()
  if (!raw) return '—'
  return raw.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function PaymentStatusBadgeCell({ status }: { status?: string | null }) {
  const resolved = status?.trim()
  if (!resolved) return <span className="text-xs text-slate-400">—</span>
  return (
    <StatusBadge status={formatPaymentStatusKey(resolved)} label={formatPaymentStatusLabel(resolved)} />
  )
}

function TableServicesCell({
  service,
  addOns,
}: {
  service?: DailyBookingRow['service']
  addOns?: DailyBookingRow['add_ons']
}) {
  const addonCount = addOns?.length ?? 0

  return (
    <div className="min-w-0 max-w-[12rem] sm:max-w-[14rem]">
      <p className="line-clamp-2 font-semibold leading-snug text-slate-900" title={service?.name ?? undefined}>
        {service?.name || '—'}
      </p>
      {service?.cn_name ? (
        <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-slate-500" title={service.cn_name}>
          {service.cn_name}
        </p>
      ) : null}
      {addonCount > 0 ? (
        <p className="mt-1 text-xs font-medium text-slate-500">
          ({addonCount} add-on{addonCount === 1 ? '' : 's'})
        </p>
      ) : null}
    </div>
  )
}


const formatTodayLabel = () => {
  const [y, m, d] = todayYmd().split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DailyBookingPageClient() {
  const date = todayYmd()
  const todayLabel = formatTodayLabel()
  const [staffId, setStaffId] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<DailyBookingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DailyBookingRow | null>(null)

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>()
    rows.forEach((row) => {
      if (row.staff?.id) map.set(row.staff.id, row.staff.name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ date })
        if (staffId) qs.set('staff_id', staffId)
        if (search.trim()) qs.set('search', search.trim())
        const res = await fetch(`/api/proxy/admin/daily-bookings?${qs.toString()}`, { cache: 'no-store', signal: controller.signal })
        const json = await res.json().catch(() => null) as DailyBookingResponse | { message?: string } | null
        if (!res.ok) throw new Error(json && 'message' in json && json.message ? json.message : 'Unable to load daily bookings.')
        if (!controller.signal.aborted) setRows((json as DailyBookingResponse)?.data?.data ?? [])
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load daily bookings.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [date, staffId, search])

  const updateSelectedPhotos = (photos: BookingServicePhoto[]) => {
    setSelected((current) => (current ? { ...current, service_photos: photos, service_photos_count: photos.length } : current))
    setRows((current) => current.map((row) => (row.id === selected?.id ? { ...row, service_photos: photos, service_photos_count: photos.length } : row)))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-slate-500">Booking / Daily operation</p>
          <h1 className="text-3xl font-semibold text-slate-900">Daily Booking</h1>
          <p className="mt-1 text-sm text-slate-600">Completed bookings for today. Upload salon service photos by booking.</p>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">COMPLETED only</span>
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[12rem_12rem_minmax(0,1fr)]">
        <div className="grid gap-1 text-sm font-semibold text-slate-700">
          <span>Date</span>
          <p className="flex h-10 items-center rounded-lg border border-slate-100 bg-slate-50 px-3 text-sm font-normal text-slate-900">
            {todayLabel}
          </p>
        </div>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Staff
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal">
            <option value="">All staff</option>
            {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Search booking no / customer
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="BK-xxxx, customer, phone..." className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal" />
        </label>
      </section>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">Completed bookings</h2>
          <span className="text-xs font-semibold text-slate-500">{loading ? 'Loading…' : `${rows.length} result${rows.length === 1 ? '' : 's'}`}</span>
        </div>

        {loading ? <p className="px-4 py-8 text-center text-sm text-slate-500">Loading daily bookings…</p> : null}
        {!loading && rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No completed bookings found for this date.</p> : null}

        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Booking</th>
                  <th className="px-4 py-3 text-left font-semibold">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Staff</th>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                  <th className="min-w-[9rem] px-4 py-3 text-left font-semibold">Services</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.booking_code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.customer_display_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.staff?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTimeRange(row.start_at, row.end_at)}</td>
                    <td className="px-4 py-3 align-top">
                      <TableServicesCell service={row.service} addOns={row.add_ons} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PaymentStatusBadgeCell status={row.payment_status ?? row.computed_payment_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setSelected(row)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/55 p-4">
          <div className="flex max-h-[min(90dvh,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Daily Booking Details</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.booking_code}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close details">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="font-semibold text-slate-500">Customer</span><br />{selected.customer_display_name}</p>
                <p><span className="font-semibold text-slate-500">Staff</span><br />{selected.staff?.name ?? '—'}</p>
                <p><span className="font-semibold text-slate-500">Date/time</span><br />{formatDateTime(selected.start_at)}</p>
                <p><span className="font-semibold text-slate-500">Status</span><br />{selected.status}</p>
                <p><span className="font-semibold text-slate-500">Payment status</span><br />{selected.payment_status ?? selected.computed_payment_status ?? '—'}</p>
                <p><span className="font-semibold text-slate-500">Paid / Balance</span><br />{money(selected.paid_amount)} / {money(selected.balance_due)}</p>
                {(() => {
                  const remarkLines = getAppointmentDisplayRemarkLines(selected)
                  if (remarkLines.length === 0) return null
                  return (
                    <div className="col-span-full space-y-1 border-t border-slate-200 pt-3">
                      {remarkLines.map((line) => (
                        <p key={`daily-booking-remark-${line.key}`} className="text-xs font-medium text-slate-600">
                          <span className="text-slate-500">{line.label}:</span>{' '}
                          <span className="whitespace-pre-wrap">{line.value}</span>
                        </p>
                      ))}
                    </div>
                  )
                })()}
              </section>

              <BookingServicesAddOnsSection row={selected} className="rounded-xl border border-slate-200 bg-white p-4" />

              <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <p><span className="font-semibold text-slate-500">Deposit paid</span><br />{money(selected.deposit_paid)}</p>
                <p><span className="font-semibold text-slate-500">Settlement paid</span><br />{money(selected.settlement_paid)}</p>
                <p><span className="font-semibold text-slate-500">Add-on amount</span><br />{money(selected.add_ons?.reduce((sum, addon) => sum + Number(addon.extra_price ?? 0), 0))}</p>
                <p><span className="font-semibold text-slate-500">Package offset</span><br />{money(selected.package_offset)}</p>
                <p><span className="font-semibold text-slate-500">Balance due</span><br />{money(selected.balance_due)}</p>
              </section>

              <BookingPhotosPaymentProofSection
                bookingId={selected.id}
                bookingCode={selected.booking_code}
                customerReferencePhotos={selected.customer_reference_photos}
                servicePhotos={selected.service_photos}
                paymentProofs={selected.payment_proofs}
                onServicePhotosChanged={updateSelectedPhotos}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
