'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import SalesVisualPeriodDashboard from '@/components/reports/SalesVisualPeriodDashboard'

type SummaryTotals = {
  ecommerce_sales: number
  booking_sales: number
  total_sales: number
  total_orders: number
}

type MonthlyRow = {
  month: number
  month_name: string
  ecommerce_orders: number
  booking_count: number
  ecommerce_sales: number
  booking_sales: number
  total_sales: number
}

type DailyRow = {
  date: string
  day: number
  ecommerce_orders: number
  booking_count: number
  ecommerce_sales: number
  booking_sales: number
  total_sales: number
}

type SalesSummaryPayload = {
  year: number
  month: number | null
  mode: 'monthly' | 'daily'
  summary: SummaryTotals
  rows: Array<MonthlyRow | DailyRow>
}

function currentYear() {
  return new Date().getFullYear()
}

function monthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
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

const fmtRm = (n: number) => `RM ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n: number) => Number(n || 0).toLocaleString()

function isDailyRow(row: MonthlyRow | DailyRow): row is DailyRow {
  return 'date' in row
}

export default function SalesSummaryWorkspaceClient({ canViewStaffReport = false }: { canViewStaffReport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedYear = Number(searchParams.get('year') || currentYear())
  const rawMonth = searchParams.get('month')
  const selectedMonth = rawMonth ? Number(rawMonth) : null
  const selectedMonthTitle = selectedMonth ? monthTitle(selectedYear, selectedMonth) : null

  const [data, setData] = useState<SalesSummaryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const yearOptions = useMemo(() => {
    const now = currentYear()
    const earliest = Math.min(selectedYear, now - 4)
    const latest = Math.max(selectedYear, now + 1)
    const years = []
    for (let y = latest; y >= earliest; y--) years.push(y)
    return years
  }, [selectedYear])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ year: String(selectedYear) })
      if (selectedMonth) qs.set('month', String(selectedMonth))
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
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    void load()
  }, [load])

  const setYear = (year: string) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', year)
    if (!selectedMonth) {
      q.delete('month')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const setMonth = (month: string) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', String(selectedYear))
    q.set('month', month)
    router.push(`${pathname}?${q.toString()}`)
  }

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = index + 1
        const label = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2024, index, 1))
        return { value, label }
      }),
    [],
  )

  const openYearSummary = () => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', String(selectedYear))
    q.delete('month')
    router.push(`${pathname}?${q.toString()}`)
  }

  const openMonth = (month: number) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', String(selectedYear))
    q.set('month', String(month))
    router.push(`${pathname}?${q.toString()}`)
  }

  const openDailyDetail = (date: string) => {
    const q = new URLSearchParams({
      date,
      year: String(selectedYear),
      month: String(selectedMonth ?? dateParts(date).month),
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
    const q = new URLSearchParams(searchParams.toString())
    if (selectedMonth) {
      let nextMonth = selectedMonth + delta
      let nextYear = selectedYear
      if (nextMonth < 1) {
        nextMonth = 12
        nextYear -= 1
      } else if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      q.set('year', String(nextYear))
      q.set('month', String(nextMonth))
    } else {
      q.set('year', String(selectedYear + delta))
      q.delete('month')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const rows = data?.rows ?? []

  const tableTotals = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce(
      (acc, row) => ({
        ecommerce_orders: acc.ecommerce_orders + row.ecommerce_orders,
        booking_count: acc.booking_count + row.booking_count,
        ecommerce_sales: acc.ecommerce_sales + row.ecommerce_sales,
        booking_sales: acc.booking_sales + row.booking_sales,
        total_sales: acc.total_sales + row.total_sales,
      }),
      { ecommerce_orders: 0, booking_count: 0, ecommerce_sales: 0, booking_sales: 0, total_sales: 0 },
    )
  }, [rows])

  return (
    <div className="overflow-y-auto px-6 py-6 lg:px-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs" aria-label="Breadcrumb">
        <span className="text-gray-500">Reports</span>
        <span className="text-gray-400">/</span>
        <button type="button" onClick={openYearSummary} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
          Sales Report
        </button>
        <span className="text-gray-400">/</span>
        {selectedMonth ? (
          <button type="button" onClick={openYearSummary} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
            {selectedYear}
          </button>
        ) : (
          <span className="font-medium text-gray-700">{selectedYear}</span>
        )}
        {selectedMonthTitle ? (
          <>
            <span className="text-gray-400">/</span>
            <span className="font-medium text-gray-700">{selectedMonthTitle.split(' ')[0]}</span>
          </>
        ) : null}
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          {selectedMonth ? (
            <button
              type="button"
              onClick={openYearSummary}
              className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ← Back to yearly summary
            </button>
          ) : null}
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">{selectedMonthTitle ? 'Monthly Sales Report' : 'Yearly Sales Report'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {selectedMonthTitle
                ? `Daily ecommerce and booking sales summary for ${selectedMonthTitle}.`
                : `Yearly ecommerce and booking sales summary for ${selectedYear}.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedMonth ? (
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Month
              <select
                value={selectedMonth}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Year
            <select
              value={selectedYear}
              onChange={(event) => setYear(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <SalesVisualPeriodDashboard year={selectedYear} month={selectedMonth} onShiftPeriod={shiftPeriod} canViewStaffReport={canViewStaffReport} />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {selectedMonthTitle ? `${selectedMonthTitle} daily summary` : `${selectedYear} monthly summary`}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Ecommerce sales count product lines only. Booking count and sales use the same booking line buckets as the Daily Sales visual report.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{selectedMonth ? 'Date' : 'Month'}</th>
                <th className="px-5 py-3 text-right">Ecommerce Order Count</th>
                <th className="px-5 py-3 text-right">Booking Count</th>
                <th className="px-5 py-3 text-right">Ecommerce Sales</th>
                <th className="px-5 py-3 text-right">Booking Sales</th>
                <th className="px-5 py-3 text-right">Total Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Loading sales summary…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No sales rows found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = isDailyRow(row) ? row.date : String(row.month)
                  const label = isDailyRow(row) ? formatDateLabel(row.date) : row.month_name
                  const onClick = isDailyRow(row) ? () => openDailyDetail(row.date) : () => openMonth(row.month)
                  const aria = isDailyRow(row) ? `Open Daily Sales detail for ${row.date}` : `Open daily summary for ${row.month_name}`

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
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmtRm(row.total_sales)}</td>
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
                  <td className="px-5 py-3 text-right">{fmtRm(tableTotals.total_sales)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  )
}
