'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Mode = 'ecommerce' | 'booking' | 'all'

type PaymentMethodRow = {
  key: string
  label: string
  online: number
  offline: number
  total: number
}

type VisualPayload = {
  date?: string
  online_offline?: { online: number; offline: number }
  payment_methods?: PaymentMethodRow[]
  item_types?: {
    estimate?: boolean
    product: number
    service: number
    multi_package: number
    unlimited_plan: number
    other?: number
  }
  points_redemption?: { message?: string | null }
  service_consumed?: { amount?: number; message?: string | null }
  staff?: {
    sales_activity?: Array<{
      staff_id: number
      name: string
      product_sales?: number
      total?: number
    }>
    sales_activity_total?: number
    service_activity?: Array<{ staff_id: number; name: string; service_count: number }>
    service_activity_total?: number
  }
}

function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDay(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

const fmtRm = (n: number) =>
  `RM ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SalesVisualDailyDashboardWithNav({ mode }: { mode: Mode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const date = searchParams.get('date') ?? formatYmd(new Date())
  const displayDate = useMemo(() => formatDisplayDay(date), [date])

  const [data, setData] = useState<VisualPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const path = mode === 'ecommerce' ? 'ecommerce' : mode === 'booking' ? 'booking' : 'all'
      const res = await fetch(
        `/api/proxy/ecommerce/reports/sales/visual-daily/${path}?date=${encodeURIComponent(date)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        setData(null)
        setError('Unable to load visual summary.')
        return
      }
      const json = (await res.json()) as VisualPayload
      setData(json)
    } catch {
      setData(null)
      setError('Unable to load visual summary.')
    } finally {
      setLoading(false)
    }
  }, [date, mode])

  useEffect(() => {
    void load()
  }, [load])

  const setDay = (next: string) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('date', next)
    q.set('date_from', next)
    q.set('date_to', next)
    q.set('page', '1')
    if (mode === 'all') {
      q.set('ec_page', '1')
      q.set('bk_page', '1')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const shiftDay = (delta: number) => {
    const base = new Date(`${date}T12:00:00`)
    base.setDate(base.getDate() + delta)
    setDay(formatYmd(base))
  }

  const payments: PaymentMethodRow[] = Array.isArray(data?.payment_methods)
    ? (data!.payment_methods as PaymentMethodRow[])
    : []

  const paymentFinalOnline = payments.reduce((a, p) => a + (Number(p.online) || 0), 0)
  const paymentFinalOffline = payments.reduce((a, p) => a + (Number(p.offline) || 0), 0)
  const paymentFinalTotal = payments.reduce((a, p) => a + (Number(p.total) || 0), 0)
  const itemTypes = data?.item_types
  const staffSales = data?.staff?.sales_activity ?? []
  const staffSvc = data?.staff?.service_activity ?? []
  const oo = data?.online_offline

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
          aria-label="Previous day"
        >
          ‹
        </button>
        <span className="min-w-[10rem] text-center text-base font-semibold text-slate-800">{displayDate}</span>
      
        <button
          type="button"
          onClick={() => shiftDay(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {oo ? (
        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Online <strong className="text-slate-900">{fmtRm(oo.online)}</strong>
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Offline <strong className="text-slate-900">{fmtRm(oo.offline)}</strong>
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Payment method</h3>
          <p className="mt-1 text-xs text-slate-500">
            All gateways from settings ({mode === 'ecommerce' ? 'ecommerce' : mode === 'booking' ? 'booking' : 'ecommerce + booking merged'}
            ). Online vs offline by order creator.
          </p>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No payment gateways configured for this workspace.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-2 pr-2">Method</th>
                    <th className="pb-2 pr-2 text-right">Online</th>
                    <th className="pb-2 pr-2 text-right">Offline</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.key} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{p.label}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-900">{fmtRm(p.online)}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-900">{fmtRm(p.offline)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{fmtRm(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="py-2.5 pr-2 text-xs font-bold tracking-wide text-slate-800">FINAL TOTAL</td>
                    <td className="py-2.5 pr-2 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalOnline)}</td>
                    <td className="py-2.5 pr-2 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalOffline)}</td>
                    <td className="py-2.5 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Item type</h3>
          <p className="text-xs text-blue-600">(estimate)</p>
          {mode === 'ecommerce' ? (
            <p className="mt-1 text-xs text-slate-500">Counts only product / service / service_package lines. Booking lines are excluded here.</p>
          ) : mode === 'all' ? (
            <p className="mt-1 text-xs text-slate-500">
              Product and catalog lines plus booking buckets (deposit, settlement, add-on, package) combined for this day.
            </p>
          ) : null}
          {loading || !itemTypes ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Product</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.product)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Service</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.service)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Package</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.multi_package)}</span>
              </li>
              {itemTypes.other != null && itemTypes.other > 0 ? (
                <li className="flex justify-between gap-2">
                  <span className="text-slate-600">Other lines</span>
                  <span className="font-semibold text-slate-900">{fmtRm(itemTypes.other)}</span>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Staff</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ecommerce</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Product sales (RM)</p>
              {loading ? (
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              ) : staffSales.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No staff configured.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {staffSales.map((s) => (
                    <li key={s.staff_id}>
                      <div className="text-slate-800">{s.name}</div>
                      <div className="font-semibold text-slate-900">{fmtRm(s.total ?? s.product_sales ?? 0)}</div>
                    </li>
                  ))}
                  <li className="border-t border-slate-100 pt-2 font-semibold text-slate-900">
                    Total {fmtRm(data?.staff?.sales_activity_total ?? 0)}
                  </li>
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Completed bookings this day</p>
              {loading ? (
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              ) : staffSvc.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No staff configured.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {staffSvc.map((s) => (
                    <li key={s.staff_id}>
                      <div className="text-slate-800">{s.name}</div>
                      <div className="font-semibold text-slate-900">{s.service_count}×</div>
                    </li>
                  ))}
                  <li className="border-t border-slate-100 pt-2 font-semibold text-slate-900">
                    Total {data?.staff?.service_activity_total ?? 0}×
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

