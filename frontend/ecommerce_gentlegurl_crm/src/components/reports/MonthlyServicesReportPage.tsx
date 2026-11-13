'use client'

import { useEffect, useMemo, useState } from 'react'

import { NameStack } from '@/components/NameStack'
import { useBranch } from '@/contexts/BranchContext'

type ServiceRow = {
  booking_service_id: number
  name: string
  cn_name?: string | null
  times: number
  amount: number
  void_times: number
  void_amount: number
}

type TopService = {
  booking_service_id: number
  name: string
  cn_name?: string | null
  times: number
}

type MonthlyServicesResponse = {
  year: number
  month_from: number
  month_to: number
  data: ServiceRow[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  summary: {
    total_services_booked: number
    total_void_times: number
    total_amount_non_void: number
    total_void_amount: number
    total_refund_amount: number
    net_amount: number
    void_plus_refund_amount: number
    top_service: string | null
    top_service_count: number
    top_service_is_tie: boolean
    top_services: TopService[]
  }
}

const filterSelectClass =
  'h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'
const filterYearSelectClass = `${filterSelectClass} w-[5.5rem]`
const filterMonthSelectClass = `${filterSelectClass} w-[7rem]`
const filterBoxClass =
  'inline-flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm'
const filterButtonPrimaryClass =
  'h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700'
const filterButtonSecondaryClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50'

function currentYear() {
  return new Date().getFullYear()
}

function currentMonth() {
  return new Date().getMonth() + 1
}

function monthShort(month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2024, month - 1, 1))
}

function normalizePair(from: number, to: number) {
  return from <= to ? { from, to } : { from: to, to: from }
}

const fmtRm = (n: number) =>
  `RM ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n: number) => Number(n || 0).toLocaleString()

type Props = {
  initialYear?: number
  initialMonthFrom?: number
  initialMonthTo?: number
}

export default function MonthlyServicesReportPage({
  initialYear,
  initialMonthFrom,
  initialMonthTo,
}: Props) {
  const { selectedBranchId } = useBranch()
  const [year, setYear] = useState(initialYear ?? currentYear())
  const [monthFrom, setMonthFrom] = useState(initialMonthFrom ?? currentMonth())
  const [monthTo, setMonthTo] = useState(initialMonthTo ?? currentMonth())
  const [appliedYear, setAppliedYear] = useState(initialYear ?? currentYear())
  const [appliedMonthFrom, setAppliedMonthFrom] = useState(initialMonthFrom ?? currentMonth())
  const [appliedMonthTo, setAppliedMonthTo] = useState(initialMonthTo ?? currentMonth())

  const [rows, setRows] = useState<ServiceRow[]>([])
  const [summary, setSummary] = useState<MonthlyServicesResponse['summary'] | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTiedServices, setShowTiedServices] = useState(false)

  const yearOptions = useMemo(() => {
    const latest = currentYear() + 1
    const earliest = latest - 10
    const years: number[] = []
    for (let y = latest; y >= earliest; y--) years.push(y)
    return years
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const pair = normalizePair(appliedMonthFrom, appliedMonthTo)
        const qs = new URLSearchParams({
          year: String(appliedYear),
          month: String(pair.from),
          month_from: String(pair.from),
          month_to: String(pair.to),
          page: String(page),
          per_page: String(perPage),
        })
        if (selectedBranchId === null) qs.set('branch_scope', 'all')
        else qs.set('branch_store_location_id', String(selectedBranchId))

        const res = await fetch(`/api/proxy/ecommerce/reports/monthly-services?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Failed to load monthly services report (${res.status})`)

        const payload: MonthlyServicesResponse = await res.json()
        setRows(payload.data ?? [])
        setSummary(payload.summary ?? null)
        setTotal(payload.total ?? 0)
        setLastPage(Math.max(payload.last_page ?? 1, 1))
        if (payload.current_page && payload.current_page !== page) {
          setPage(payload.current_page)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load monthly services report.')
        setRows([])
        setSummary(null)
        setTotal(0)
        setLastPage(1)
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [appliedYear, appliedMonthFrom, appliedMonthTo, selectedBranchId, page, perPage])

  const topCard = useMemo(() => {
    if (!summary) return null
    if (summary.top_service_is_tie && summary.top_services.length > 1) {
      return {
        label: 'Top Service',
        primary: `${summary.top_services.length} services tied`,
        secondary: `${fmtInt(summary.top_service_count)} times each`,
        badge: 'Tie',
        showView: true,
      }
    }
    if (summary.top_service) {
      return {
        label: 'Top Service',
        primary: summary.top_service,
        secondary: `${fmtInt(summary.top_service_count)} times`,
        badge: undefined as string | undefined,
        showView: false,
      }
    }
    return {
      label: 'Top Service',
      primary: 'No service data',
      secondary: undefined as string | undefined,
      badge: undefined as string | undefined,
      showView: false,
    }
  }, [summary])

  const pageTotals = useMemo(() => {
    return {
      times: rows.reduce((sum, row) => sum + row.times, 0),
      voidTimes: rows.reduce((sum, row) => sum + row.void_times, 0),
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      voidAmount: rows.reduce((sum, row) => sum + row.void_amount, 0),
    }
  }, [rows])

  const startItem = useMemo(() => (total === 0 ? 0 : (page - 1) * perPage + 1), [page, perPage, total])
  const endItem = useMemo(() => Math.min(page * perPage, total), [page, perPage, total])

  const applyFilters = () => {
    const pair = normalizePair(monthFrom, monthTo)
    setMonthFrom(pair.from)
    setMonthTo(pair.to)
    setAppliedYear(year)
    setAppliedMonthFrom(pair.from)
    setAppliedMonthTo(pair.to)
    setPage(1)
  }

  const resetFilters = () => {
    const y = currentYear()
    const m = currentMonth()
    setYear(y)
    setMonthFrom(m)
    setMonthTo(m)
    setAppliedYear(y)
    setAppliedMonthFrom(m)
    setAppliedMonthTo(m)
    setPage(1)
    setPerPage(15)
  }

  return (
    <div className="space-y-5">
      {summary && topCard ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Services Booked" value={fmtInt(summary.total_services_booked)} accent="blue" />
          <SummaryCard label="Total Amount After Void" value={fmtRm(summary.net_amount)} accent="indigo" />
          <SummaryCard
            label={topCard.label}
            value={topCard.primary}
            secondary={topCard.secondary}
            badge={topCard.badge}
            accent="emerald"
            onView={topCard.showView ? () => setShowTiedServices(true) : undefined}
            viewLabel="View tied services"
          />
          <SummaryCard
            label="Void + Refunded Amount"
            value={fmtRm(summary.void_plus_refund_amount)}
            secondary={
              summary.total_refund_amount > 0 || summary.total_void_amount > 0
                ? `Void ${fmtRm(summary.total_void_amount)} · Refund ${fmtRm(summary.total_refund_amount)}`
                : undefined
            }
            accent="rose"
          />
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className={filterBoxClass}>
            <div>
              <label className="text-xs text-gray-500">Year</label>
              <select className={`${filterYearSelectClass} mt-1 block`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Month From</label>
              <select
                className={`${filterMonthSelectClass} mt-1 block`}
                value={monthFrom}
                onChange={(e) => setMonthFrom(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthShort(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Month To</label>
              <select
                className={`${filterMonthSelectClass} mt-1 block`}
                value={monthTo}
                onChange={(e) => setMonthTo(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthShort(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className={filterButtonPrimaryClass} onClick={applyFilters} disabled={loading}>
              Apply
            </button>
            <button type="button" className={filterButtonSecondaryClass} onClick={resetFilters} disabled={loading}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <label htmlFor="monthly-services-page-size" className="text-sm text-gray-700">
          Show
        </label>
        <select
          id="monthly-services-page-size"
          value={perPage}
          onChange={(e) => {
            setPerPage(Number(e.target.value))
            setPage(1)
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
          disabled={loading}
        >
          {[15, 30, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Service</th>
                <th className="px-4 py-3 text-right">Times</th>
                <th className="px-4 py-3 text-right">Void</th>
                <th className="px-4 py-3 text-right">Amount After Void</th>
                <th className="px-4 py-3 text-right">Void Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    Loading monthly services report...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-6 text-center text-red-600" colSpan={5}>
                    {error}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    No completed or voided services found for this period.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr className="border-t" key={row.booking_service_id}>
                    <td className="px-4 py-3">
                      <NameStack
                        name={row.name}
                        cnName={row.cn_name}
                        primaryClassName="font-medium text-slate-900"
                        secondaryClassName="mt-0.5 text-xs text-slate-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtInt(row.times)}</td>
                    <td className="px-4 py-3 text-right">{fmtInt(row.void_times)}</td>
                    <td className="px-4 py-3 text-right">{fmtRm(row.amount)}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{fmtRm(row.void_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && summary ? (
              <tfoot>
                <tr className="border-t bg-slate-50 font-semibold text-slate-800">
                  <td className="px-4 py-3 text-left">Page Total</td>
                  <td className="px-4 py-3 text-right">{fmtInt(pageTotals.times)}</td>
                  <td className="px-4 py-3 text-right">{fmtInt(pageTotals.voidTimes)}</td>
                  <td className="px-4 py-3 text-right">{fmtRm(pageTotals.amount)}</td>
                  <td className="px-4 py-3 text-right text-rose-700">{fmtRm(pageTotals.voidAmount)}</td>
                </tr>
                <tr className="border-t bg-slate-100 font-semibold text-slate-900">
                  <td className="px-4 py-3 text-left">All Total</td>
                  <td className="px-4 py-3 text-right">{fmtInt(summary.total_services_booked)}</td>
                  <td className="px-4 py-3 text-right">{fmtInt(summary.total_void_times)}</td>
                  <td className="px-4 py-3 text-right">{fmtRm(summary.net_amount)}</td>
                  <td className="px-4 py-3 text-right text-rose-700">{fmtRm(summary.total_void_amount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <div className="text-slate-600">
            Showing {startItem} - {endItem} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="text-slate-700">
              Page {page} / {lastPage}
            </span>
            <button
              className="rounded-md border px-3 py-1 disabled:opacity-50"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showTiedServices && summary?.top_services ? (
        <TiedServicesModal services={summary.top_services} onClose={() => setShowTiedServices(false)} />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  secondary,
  badge,
  accent,
  onView,
  viewLabel,
}: {
  label: string
  value: string | number
  secondary?: string
  badge?: string
  accent: 'blue' | 'indigo' | 'emerald' | 'rose'
  onView?: () => void
  viewLabel?: string
}) {
  const accentClass = {
    blue: 'from-blue-50 to-blue-100/40 border-blue-200 text-blue-900',
    indigo: 'from-indigo-50 to-indigo-100/40 border-indigo-200 text-indigo-900',
    emerald: 'from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900',
    rose: 'from-rose-50 to-rose-100/40 border-rose-200 text-rose-900',
  }[accent]

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs opacity-80">{label}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge ? (
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-300/60">
              {badge}
            </span>
          ) : null}
          {onView ? (
            <button
              type="button"
              onClick={onView}
              className="inline-flex rounded-lg border border-emerald-300/70 bg-white/70 p-1.5 text-emerald-800 hover:bg-white"
              aria-label={viewLabel ?? 'View details'}
              title={viewLabel ?? 'View details'}
            >
              <EyeIcon />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1 text-xl font-semibold leading-snug break-words">{value}</div>
      {secondary ? <div className="mt-1 text-xs opacity-75">{secondary}</div> : null}
    </div>
  )
}

function TiedServicesModal({ services, onClose }: { services: TopService[]; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tied-services-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <h3 id="tied-services-title" className="text-lg font-semibold text-slate-900">
            Tied top services
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close tied services">
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-5">
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {services.map((service) => (
              <li key={service.booking_service_id} className="px-4 py-3">
                <NameStack
                  name={service.name}
                  cnName={service.cn_name}
                  primaryClassName="font-medium text-slate-900"
                  secondaryClassName="mt-0.5 text-xs text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">{fmtInt(service.times)} times</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}
