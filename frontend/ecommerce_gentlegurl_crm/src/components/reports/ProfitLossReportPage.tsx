'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ProfitLossRow = {
  month: number
  month_name: string
  ecommerce_sales: number
  ecommerce_costing: number
  booking_sales: number
  refund: number
  expense: number
  profit_loss: number
}

type ProfitLossPayload = {
  year: number
  months: ProfitLossRow[]
  totals: Omit<ProfitLossRow, 'month' | 'month_name'>
}

const formatCurrency = (amount: number) => {
  const value = Number(amount || 0)
  return `${value < 0 ? '-' : ''}RM${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ProfitLossReportPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentYear = new Date().getFullYear()
  const selectedYear = Math.max(2000, Math.min(2100, Number(searchParams.get('year')) || currentYear))
  const [data, setData] = useState<ProfitLossPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const years = useMemo(() => Array.from({ length: 13 }, (_, index) => currentYear + 2 - index), [currentYear])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/proxy/admin/reports/profit-loss?year=${selectedYear}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load profit and loss report.')
      setData((await response.json()) as ProfitLossPayload)
    } catch {
      setData(null)
      setError('Unable to load profit and loss report.')
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { void load() }, [load])

  const changeYear = (year: number) => router.push(`${pathname}?year=${year}`)
  const rows = data?.months ?? Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    month_name: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2024, index, 1)),
    ecommerce_sales: 0,
    ecommerce_costing: 0,
    booking_sales: 0,
    refund: 0,
    expense: 0,
    profit_loss: 0,
  }))

  return (
    <div className="overflow-y-auto px-6 py-6 lg:px-10">
      <nav className="mb-4 flex items-center gap-1 text-xs" aria-label="Breadcrumb">
        <span className="text-gray-500">Reports</span><span className="text-gray-400">/</span><span className="font-medium text-gray-700">Profit &amp; Loss</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{selectedYear} Monthly Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-slate-600">Monthly ecommerce and booking sales, product costing, refunds, and expenses.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">Year
          <select value={selectedYear} onChange={(event) => changeYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3 font-semibold">Month</th><th className="px-4 py-3 text-right font-semibold">Ecommerce Sales</th><th className="px-4 py-3 text-right font-semibold">Ecommerce Costing</th><th className="px-4 py-3 text-right font-semibold">Booking Sales</th><th className="px-4 py-3 text-right font-semibold">Refund</th><th className="px-4 py-3 text-right font-semibold">Expense</th><th className="px-4 py-3 text-right font-semibold">Profit &amp; Loss</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => <tr key={row.month} className="text-slate-700"><td className="px-4 py-3 font-medium">{row.month_name}</td><Currency value={row.ecommerce_sales} /><Currency value={row.ecommerce_costing} /><Currency value={row.booking_sales} /><Currency value={row.refund} /><Currency value={row.expense} /><Currency value={row.profit_loss} profit /></tr>)}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900"><tr><td className="px-4 py-3">Total</td><Currency value={data?.totals.ecommerce_sales ?? 0} /><Currency value={data?.totals.ecommerce_costing ?? 0} /><Currency value={data?.totals.booking_sales ?? 0} /><Currency value={data?.totals.refund ?? 0} /><Currency value={data?.totals.expense ?? 0} /><Currency value={data?.totals.profit_loss ?? 0} profit /></tr></tfoot>
          </table>
          {loading && <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">Loading report…</div>}
        </div>
      )}
    </div>
  )
}

function Currency({ value, profit = false }: { value: number; profit?: boolean }) {
  return <td className={`px-4 py-3 text-right tabular-nums ${profit ? (value < 0 ? 'text-red-600' : 'text-emerald-700') : ''}`}>{formatCurrency(value)}</td>
}
