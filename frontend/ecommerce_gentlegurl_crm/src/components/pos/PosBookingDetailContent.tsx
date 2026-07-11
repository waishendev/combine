'use client'

import type { PosAppointmentDetail } from '@/components/pos/posAppointmentTypes'

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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

function PackageBadge({ name }: { name: string }) {
  return (
    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
      [PKG] {name}
    </span>
  )
}

export type PosBookingDetailContentProps = {
  detail: PosAppointmentDetail | null
  loading?: boolean
  error?: string | null
}

export default function PosBookingDetailContent({ detail, loading = false, error = null }: PosBookingDetailContentProps) {
  if (loading) {
    return <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading booking detail...</p>
  }

  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
  }

  if (!detail) return null

  const activeClaims = (detail.package_claims ?? []).filter((claim) => ['reserved', 'consumed'].includes(String(claim.status)))
  const claimForService = (serviceId?: number | null) =>
    activeClaims.find((claim) => Number(claim.booking_service_id) === Number(serviceId ?? 0))
  const mainRows: Array<{ id?: number | null; name: string; cn_name?: string | null; linked_booking_service_id?: number | null }> =
    detail.main_services?.length
      ? detail.main_services
      : detail.service
        ? [{ id: detail.service.id, name: detail.service.name, cn_name: detail.service.cn_name, linked_booking_service_id: detail.service.id }]
        : []

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Booking Info</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Info label="Booking number" value={detail.booking_code} />
          <Info label="Booking status" value={detail.status} />
          <Info label="Payment status" value={detail.payment_status} />
          <Info label="Created time" value={fmtDateTime((detail as { created_at?: string | null }).created_at)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Services</p>
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <div>
            <span className="font-semibold text-slate-900">Main service(s):</span>
            <div className="mt-1 space-y-1">
              {mainRows.length
                ? mainRows.map((item) => {
                    const claim = claimForService(item.linked_booking_service_id ?? item.id)
                    return (
                      <div key={`main-${item.id ?? item.name}`} className="flex flex-col">
                        <span>{item.name}</span>
                        {claim ? <PackageBadge name={claim.package_name} /> : null}
                      </div>
                    )
                  })
                : '—'}
            </div>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Add-ons:</span>
            <div className="mt-1 space-y-1">
              {detail.add_ons?.length
                ? detail.add_ons.map((item) => {
                    const claim = claimForService(item.linked_booking_service_id)
                    return (
                      <div key={`addon-${item.id ?? item.name}`} className="flex flex-col">
                        <span>{item.name}</span>
                        {claim ? <PackageBadge name={claim.package_name} /> : null}
                      </div>
                    )
                  })
                : '—'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Staff / Schedule</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Info
            label="Staff"
            value={
              detail.staff_splits?.length
                ? detail.staff_splits.map((split) => `${split.staff_name} ${split.share_percent}%`).join(', ')
                : detail.staff?.name
            }
          />
          <Info
            label="Appointment start/end"
            value={`${fmtDateTime(detail.appointment_start_at)}${detail.appointment_end_at ? ` - ${fmtDateTime(detail.appointment_end_at)}` : ''}`}
          />
          <Info
            label="Duration"
            value={
              calcDurationMinutes(detail.appointment_start_at, detail.appointment_end_at) != null
                ? `${calcDurationMinutes(detail.appointment_start_at, detail.appointment_end_at)} min`
                : detail.estimated_duration_min
                  ? `${detail.estimated_duration_min} min`
                  : '—'
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes / Remarks</p>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Customer remarks:</span> {detail.notes || '—'}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Settlement remarks:</span> {detail.settlement_notes || '—'}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Reschedule reason:</span> {detail.reschedule_reason || '—'}
          </p>
        </div>
      </section>
    </div>
  )
}
