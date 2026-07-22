'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import SalesVisualPeriodDashboard from '@/components/reports/SalesVisualPeriodDashboard'

type SummaryTotals = {
  ecommerce_sales: number
  booking_sales: number
  refund: number
  total_sales: number
  total_orders: number
}

type MonthlyRow = {
  month: number
  month_name: string
  year?: number
  ecommerce_orders: number
  booking_count: number
  ecommerce_sales: number
  booking_sales: number
  refund: number
  total_sales: number
}

type DailyRow = {
  date: string
  day: number
  ecommerce_orders: number
  booking_count: number
  ecommerce_sales: number
  booking_sales: number
  refund: number
  total_sales: number
}

type SalesSummaryPayload = {
  year: number
  year_from?: number
  year_to?: number
  month: number | null
  month_from?: number | null
  month_to?: number | null
  mode: 'monthly' | 'daily' | 'yearly'
  summary: SummaryTotals
  rows: Array<MonthlyRow | DailyRow>
}

function currentYear() {
  return new Date().getFullYear()
}

function currentMonth() {
  return new Date().getMonth() + 1
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function monthShort(month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2024, month - 1, 1))
}

function formatDateLabel(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

function dateParts(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) {
    return { year: currentYear(), month: 1 }
  }

  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function normalizePair(from: number, to: number) {
  return from <= to ? { from, to } : { from: to, to: from }
}

const fmtRm = (n: number) => `RM ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n: number) => Number(n || 0).toLocaleString()

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

function isDailyRow(row: MonthlyRow | DailyRow): row is DailyRow {
  return 'date' in row
}

export default function SalesSummaryWorkspaceClient({ canViewStaffReport = false }: { canViewStaffReport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedYear = Number(searchParams.get('year') || currentYear())
  const hasMonthFilter = searchParams.has('month') || searchParams.has('month_from') || searchParams.has('month_to')
  const rawMonthFrom = Number(searchParams.get('month_from') || searchParams.get('month') || 0)
  const rawMonthTo = Number(searchParams.get('month_to') || searchParams.get('month') || rawMonthFrom || 0)
  const monthPair = hasMonthFilter && rawMonthFrom > 0
    ? normalizePair(Math.max(1, Math.min(12, rawMonthFrom)), Math.max(1, Math.min(12, rawMonthTo || rawMonthFrom)))
    : null
  const selectedMonthFrom = monthPair?.from ?? null
  const selectedMonthTo = monthPair?.to ?? null
  const isMonthlyView = selectedMonthFrom != null

  const rawYearFrom = Number(searchParams.get('year_from') || selectedYear)
  const rawYearTo = Number(searchParams.get('year_to') || rawYearFrom)
  const yearPair = normalizePair(
    Number.isFinite(rawYearFrom) && rawYearFrom > 0 ? rawYearFrom : selectedYear,
    Number.isFinite(rawYearTo) && rawYearTo > 0 ? rawYearTo : selectedYear,
  )
  const selectedYearFrom = isMonthlyView ? selectedYear : yearPair.from
  const selectedYearTo = isMonthlyView ? selectedYear : yearPair.to
  const isMultiYear = !isMonthlyView && selectedYearFrom !== selectedYearTo

  const monthRangeTitle = useMemo(() => {
    if (!selectedMonthFrom || !selectedMonthTo) return null
    if (selectedMonthFrom === selectedMonthTo) return monthTitle(selectedYear, selectedMonthFrom)
    return `${monthShort(selectedMonthFrom)} – ${monthShort(selectedMonthTo)} ${selectedYear}`
  }, [selectedMonthFrom, selectedMonthTo, selectedYear])

  const yearRangeLabel = useMemo(() => {
    if (selectedYearFrom === selectedYearTo) return String(selectedYearFrom)
    return `${selectedYearFrom} – ${selectedYearTo}`
  }, [selectedYearFrom, selectedYearTo])

  const [data, setData] = useState<SalesSummaryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draftYearFrom, setDraftYearFrom] = useState(String(selectedYearFrom))
  const [draftYearTo, setDraftYearTo] = useState(String(selectedYearTo))
  const [draftMonthFrom, setDraftMonthFrom] = useState(String(selectedMonthFrom ?? currentMonth()))
  const [draftMonthTo, setDraftMonthTo] = useState(String(selectedMonthTo ?? selectedMonthFrom ?? currentMonth()))

  useEffect(() => {
    setDraftYearFrom(String(selectedYearFrom))
    setDraftYearTo(String(selectedYearTo))
  }, [selectedYearFrom, selectedYearTo])

  useEffect(() => {
    if (selectedMonthFrom != null && selectedMonthTo != null) {
      setDraftMonthFrom(String(selectedMonthFrom))
      setDraftMonthTo(String(selectedMonthTo))
    }
  }, [selectedMonthFrom, selectedMonthTo])

  const yearOptions = useMemo(() => {
    const now = currentYear()
    const earliest = Math.min(selectedYearFrom, selectedYearTo, now - 10)
    const latest = Math.max(selectedYearFrom, selectedYearTo, now + 2)
    const years: number[] = []
    for (let y = latest; y >= earliest; y--) years.push(y)
    return years
  }, [selectedYearFrom, selectedYearTo])

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = index + 1
        const label = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2024, index, 1))
        return { value, label }
      }),
    [],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (isMonthlyView && selectedMonthFrom != null && selectedMonthTo != null) {
        qs.set('year', String(selectedYear))
        qs.set('month', String(selectedMonthFrom))
        qs.set('month_from', String(selectedMonthFrom))
        qs.set('month_to', String(selectedMonthTo))
      } else {
        qs.set('year', String(selectedYearFrom))
        qs.set('year_from', String(selectedYearFrom))
        qs.set('year_to', String(selectedYearTo))
      }
      const res = await fetch(`/api/proxy/ecommerce/reports/sales-summary?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setData(null)
        setError('Unable to load sales summary.')
        return
      }
      setData((await res.json()) as SalesSummaryPayload)
    } catch {
      setData(null)
      setError('Unable to load sales summary.')
    } finally {
      setLoading(false)
    }
  }, [isMonthlyView, selectedMonthFrom, selectedMonthTo, selectedYear, selectedYearFrom, selectedYearTo])

  useEffect(() => {
    void load()
  }, [load])

  const openYearSummary = (year = selectedYearFrom) => {
    const q = new URLSearchParams()
    q.set('year', String(year))
    q.set('year_from', String(year))
    q.set('year_to', String(year))
    router.push(`${pathname}?${q.toString()}`)
  }

  const applyYearRange = () => {
    const pair = normalizePair(Number(draftYearFrom) || currentYear(), Number(draftYearTo) || currentYear())
    const q = new URLSearchParams()
    q.set('year', String(pair.from))
    q.set('year_from', String(pair.from))
    q.set('year_to', String(pair.to))
    router.push(`${pathname}?${q.toString()}`)
  }

  const resetYearRange = () => {
    const y = currentYear()
    setDraftYearFrom(String(y))
    setDraftYearTo(String(y))
    const q = new URLSearchParams()
    q.set('year', String(y))
    q.set('year_from', String(y))
    q.set('year_to', String(y))
    router.push(`${pathname}?${q.toString()}`)
  }

  const applyMonthRange = () => {
    const pair = normalizePair(
      Math.max(1, Math.min(12, Number(draftMonthFrom) || 1)),
      Math.max(1, Math.min(12, Number(draftMonthTo) || 1)),
    )
    const q = new URLSearchParams()
    q.set('year', String(selectedYear))
    q.set('month', String(pair.from))
    q.set('month_from', String(pair.from))
    q.set('month_to', String(pair.to))
    router.push(`${pathname}?${q.toString()}`)
  }

  const resetMonthRange = () => {
    const m = currentMonth()
    setDraftMonthFrom(String(m))
    setDraftMonthTo(String(m))
    const q = new URLSearchParams()
    q.set('year', String(selectedYear))
    q.set('month', String(m))
    q.set('month_from', String(m))
    q.set('month_to', String(m))
    router.push(`${pathname}?${q.toString()}`)
  }

  const openMonth = (month: number) => {
    const q = new URLSearchParams()
    q.set('year', String(selectedYearFrom === selectedYearTo ? selectedYearFrom : selectedYear))
    q.set('month', String(month))
    q.set('month_from', String(month))
    q.set('month_to', String(month))
    router.push(`${pathname}?${q.toString()}`)
  }

  const openDailyDetail = (date: string) => {
    const parts = dateParts(date)
    const q = new URLSearchParams({
      date,
      year: String(parts.year),
      month: String(parts.month),
      mode: 'all',
      date_from: date,
      date_to: date,
      page: '1',
      ec_page: '1',
      bk_page: '1',
    })
    router.push(`/reports/sales/daily?${q.toString()}`)
  }

  const shiftPeriod = (delta: number) => {
    if (isMonthlyView && selectedMonthFrom != null && selectedMonthTo != null) {
      if (selectedMonthFrom !== selectedMonthTo) return
      let nextMonth = selectedMonthFrom + delta
      let nextYear = selectedYear
      if (nextMonth < 1) {
        nextMonth = 12
        nextYear -= 1
      } else if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      const q = new URLSearchParams()
      q.set('year', String(nextYear))
      q.set('month', String(nextMonth))
      q.set('month_from', String(nextMonth))
      q.set('month_to', String(nextMonth))
      router.push(`${pathname}?${q.toString()}`)
      return
    }

    if (isMultiYear) return
    const nextYear = selectedYearFrom + delta
    const q = new URLSearchParams()
    q.set('year', String(nextYear))
    q.set('year_from', String(nextYear))
    q.set('year_to', String(nextYear))
    router.push(`${pathname}?${q.toString()}`)
  }

  const rows = data?.rows ?? []
  const isYearlyRows = !isMonthlyView && (isMultiYear || data?.mode === 'yearly')

  const tableTotals = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce(
      (acc, row) => ({
        ecommerce_orders: acc.ecommerce_orders + row.ecommerce_orders,
        booking_count: acc.booking_count + row.booking_count,
        ecommerce_sales: acc.ecommerce_sales + row.ecommerce_sales,
        booking_sales: acc.booking_sales + row.booking_sales,
        refund: acc.refund + (Number(row.refund) || 0),
        total_sales: acc.total_sales + row.total_sales,
      }),
      { ecommerce_orders: 0, booking_count: 0, ecommerce_sales: 0, booking_sales: 0, refund: 0, total_sales: 0 },
    )
  }, [rows])

  const subtitle = isMonthlyView
    ? `Daily ecommerce and booking sales summary for ${monthRangeTitle}.`
    : `Yearly ecommerce and booking sales summary for ${yearRangeLabel}.`

  const tableHeading = isMonthlyView
    ? `${monthRangeTitle} daily summary`
    : isMultiYear
      ? `${yearRangeLabel} yearly summary`
      : `${selectedYearFrom} monthly summary`

  const firstColumnLabel = isMonthlyView ? 'Date' : isYearlyRows ? 'Year' : 'Month'
  const canShiftPeriod =
    (isMonthlyView && selectedMonthFrom != null && selectedMonthFrom === selectedMonthTo)
    || (!isMonthlyView && !isMultiYear)

  return (
    <div className="overflow-y-auto px-6 py-6 lg:px-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs" aria-label="Breadcrumb">
        <span className="text-gray-500">Reports</span>
        <span className="text-gray-400">/</span>
        <button type="button" onClick={() => openYearSummary(selectedYear)} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
          Sales Report
        </button>
        <span className="text-gray-400">/</span>
        {isMonthlyView ? (
          <button type="button" onClick={() => openYearSummary(selectedYear)} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
            {selectedYear}
          </button>
        ) : (
          <span className="font-medium text-gray-700">{yearRangeLabel}</span>
        )}
        {monthRangeTitle ? (
          <>
            <span className="text-gray-400">/</span>
            <span className="font-medium text-gray-700">
              {selectedMonthFrom === selectedMonthTo
                ? monthShort(selectedMonthFrom!)
                : `${monthShort(selectedMonthFrom!)} – ${monthShort(selectedMonthTo!)}`}
            </span>
          </>
        ) : null}
      </nav>

      <div className="mb-6 space-y-3">
        {isMonthlyView ? (
          <button
            type="button"
            onClick={() => openYearSummary(selectedYear)}
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Back to yearly summary
          </button>
        ) : null}
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">{isMonthlyView ? 'Monthly Sales Report' : 'Yearly Sales Report'}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        {isMonthlyView ? (
          <div className={filterBoxClass}>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              From
              <select value={draftMonthFrom} onChange={(event) => setDraftMonthFrom(event.target.value)} className={filterMonthSelectClass}>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              To
              <select value={draftMonthTo} onChange={(event) => setDraftMonthTo(event.target.value)} className={filterMonthSelectClass}>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={applyMonthRange} className={filterButtonPrimaryClass}>
              Apply
            </button>
            <button type="button" onClick={resetMonthRange} className={filterButtonSecondaryClass}>
              This month
            </button>
          </div>
        ) : (
          <div className={filterBoxClass}>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              From
              <select value={draftYearFrom} onChange={(event) => setDraftYearFrom(event.target.value)} className={filterYearSelectClass}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              To
              <select value={draftYearTo} onChange={(event) => setDraftYearTo(event.target.value)} className={filterYearSelectClass}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={applyYearRange} className={filterButtonPrimaryClass}>
              Apply
            </button>
            <button type="button" onClick={resetYearRange} className={filterButtonSecondaryClass}>
              This year
            </button>
          </div>
        )}
      </div>

      {error ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <SalesVisualPeriodDashboard
        year={selectedYear}
        yearFrom={selectedYearFrom}
        yearTo={selectedYearTo}
        month={selectedMonthFrom}
        monthFrom={selectedMonthFrom}
        monthTo={selectedMonthTo}
        onShiftPeriod={canShiftPeriod ? shiftPeriod : undefined}
        canViewStaffReport={canViewStaffReport}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{tableHeading}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Ecommerce and Booking sales exclude refunded orders. Refund is completed refund amount for the period
            (VOID REFUND excluded). Total Sales = Ecommerce Sales + Booking Sales − Refund.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{firstColumnLabel}</th>
                <th className="px-5 py-3 text-right">Ecommerce Order Count</th>
                <th className="px-5 py-3 text-right">Booking Count</th>
                <th className="px-5 py-3 text-right">
                  Ecommerce Sales
                  <br />
                  <span className="font-medium normal-case tracking-normal text-slate-400">(Exclude Refund)</span>
                </th>
                <th className="px-5 py-3 text-right">
                  Booking Sales
                  <br />
                  <span className="font-medium normal-case tracking-normal text-slate-400">(Exclude Refund)</span>
                </th>
                <th className="px-5 py-3 text-right text-rose-600">Refund</th>
                <th className="px-5 py-3 text-right text-indigo-700">
                  Total Sales
                  <br />
                  <span className="font-medium normal-case tracking-normal text-indigo-500">(Incl. Refund)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Loading sales summary…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No sales rows found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = isDailyRow(row) ? row.date : String(row.year ?? row.month)
                  const label = isDailyRow(row) ? formatDateLabel(row.date) : row.month_name
                  const onClick = isDailyRow(row)
                    ? () => openDailyDetail(row.date)
                    : isYearlyRows
                      ? () => openYearSummary(Number(row.year ?? row.month))
                      : () => openMonth(row.month)
                  const aria = isDailyRow(row)
                    ? `Open Daily Sales detail for ${row.date}`
                    : isYearlyRows
                      ? `Open yearly summary for ${row.month_name}`
                      : `Open daily summary for ${row.month_name}`
                  const refund = Number(row.refund) || 0

                  return (
                    <tr key={key} className="hover:bg-blue-50/50">
                      <td className="px-5 py-3">
                        <button type="button" onClick={onClick} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline" aria-label={aria}>
                          {label}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{fmtInt(row.ecommerce_orders)}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{fmtInt(row.booking_count)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{fmtRm(row.ecommerce_sales)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{fmtRm(row.booking_sales)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${refund > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {refund > 0 ? fmtRm(-Math.abs(refund)) : fmtRm(0)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-indigo-700">{fmtRm(row.total_sales)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!loading && tableTotals ? (
              <tfoot>
                <tr className="border-t-2 border-blue-300 bg-blue-50 text-sm font-bold text-blue-950">
                  <td className="px-5 py-3 text-xs uppercase tracking-wide">Total</td>
                  <td className="px-5 py-3 text-right">{fmtInt(tableTotals.ecommerce_orders)}</td>
                  <td className="px-5 py-3 text-right">{fmtInt(tableTotals.booking_count)}</td>
                  <td className="px-5 py-3 text-right">{fmtRm(tableTotals.ecommerce_sales)}</td>
                  <td className="px-5 py-3 text-right">{fmtRm(tableTotals.booking_sales)}</td>
                  <td className={`px-5 py-3 text-right ${tableTotals.refund > 0 ? 'text-rose-800' : 'text-slate-600'}`}>
                    {tableTotals.refund > 0 ? fmtRm(-Math.abs(tableTotals.refund)) : fmtRm(0)}
                  </td>
                  <td className="px-5 py-3 text-right text-indigo-800">{fmtRm(tableTotals.total_sales)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  )
}
