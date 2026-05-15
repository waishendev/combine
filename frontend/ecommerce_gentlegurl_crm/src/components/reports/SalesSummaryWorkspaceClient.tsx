'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

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
  ecommerce_sales: number
  booking_sales: number
  total_sales: number
}

type DailyRow = {
  date: string
  day: number
  ecommerce_orders: number
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

const fmtRm = (n: number) => `RM ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n: number) => Number(n || 0).toLocaleString()

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function isDailyRow(row: MonthlyRow | DailyRow): row is DailyRow {
  return 'date' in row
}

export default function SalesSummaryWorkspaceClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedYear = Number(searchParams.get('year') || currentYear())
  const rawMonth = searchParams.get('month')
  const selectedMonth = rawMonth ? Number(rawMonth) : null

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
    q.delete('month')
    router.push(`${pathname}?${q.toString()}`)
  }

  const openMonth = (month: number) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', String(selectedYear))
    q.set('month', String(month))
    router.push(`${pathname}?${q.toString()}`)
  }

  const clearMonth = () => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('year', String(selectedYear))
    q.delete('month')
    router.push(`${pathname}?${q.toString()}`)
  }

  const openDailyVisual = (date: string) => {
    const q = new URLSearchParams({ mode: 'all', date, date_from: date, date_to: date, page: '1', ec_page: '1', bk_page: '1' })
    router.push(`/reports/sales/visual?${q.toString()}`)
  }

  const totals = data?.summary ?? { ecommerce_sales: 0, booking_sales: 0, total_sales: 0, total_orders: 0 }
  const rows = data?.rows ?? []

  return (
    <div className="overflow-y-auto px-6 py-6 lg:px-10">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Sales report</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Sales report</h2>
          <p className="mt-1 text-sm text-slate-600">
            {selectedMonth
              ? `Daily ecommerce and booking sales summary for ${monthTitle(selectedYear, selectedMonth)}.`
              : `Monthly ecommerce and booking sales summary for ${selectedYear}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedMonth ? (
            <button
              type="button"
              onClick={clearMonth}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ← Back to months
            </button>
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Ecommerce Sales" value={fmtRm(totals.ecommerce_sales)} accent="text-blue-700" />
        <SummaryCard label="Booking Sales" value={fmtRm(totals.booking_sales)} accent="text-violet-700" />
        <SummaryCard label="Total Sales" value={fmtRm(totals.total_sales)} accent="text-emerald-700" />
        <SummaryCard label="Total Orders" value={fmtInt(totals.total_orders)} accent="text-slate-900" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {selectedMonth ? `${monthTitle(selectedYear, selectedMonth)} daily summary` : `${selectedYear} monthly summary`}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Ecommerce sales count product lines only. Booking sales use the same booking line buckets as the Daily Sales visual report.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">{selectedMonth ? 'Date' : 'Month'}</th>
                <th className="px-5 py-3 text-right">Ecommerce Orders</th>
                <th className="px-5 py-3 text-right">Ecommerce Sales</th>
                <th className="px-5 py-3 text-right">Booking Sales</th>
                <th className="px-5 py-3 text-right">Total Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Loading sales summary…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No sales rows found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = isDailyRow(row) ? row.date : String(row.month)
                  const label = isDailyRow(row) ? formatDateLabel(row.date) : row.month_name
                  const onClick = isDailyRow(row) ? () => openDailyVisual(row.date) : () => openMonth(row.month)
                  const aria = isDailyRow(row) ? `Open Daily Sales visual for ${row.date}` : `Open daily summary for ${row.month_name}`

                  return (
                    <tr key={key} className="hover:bg-blue-50/50">
                      <td className="px-5 py-3">
                        <button type="button" onClick={onClick} className="font-semibold text-blue-700 hover:text-blue-900 hover:underline" aria-label={aria}>
                          {label}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{fmtInt(row.ecommerce_orders)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{fmtRm(row.ecommerce_sales)}</td>
                      <td className="px-5 py-3 text-right text-slate-700">{fmtRm(row.booking_sales)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmtRm(row.total_sales)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
