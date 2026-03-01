'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'

type Summary = {
  orders_count: number
  items_count: number
  items_with_staff_count: number
  items_without_staff_count: number
  total_item_amount: number
  total_staff_commission: number
  my_commission: number
}

type StaffSplit = {
  staff_id: number | null
  staff_name: string | null
  share_percent: number
  commission_rate_snapshot: number
  staff_commission_amount: number
}

type DetailRow = {
  order_no: string | null
  order_id: number
  order_date: string
  order_item_id: number
  product_name: string | null
  qty: number
  item_total_price: number
  has_staff_assignment: boolean
  staff_splits: StaffSplit[]
}

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = new Date().toISOString().slice(0, 10)
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10)

const emptySummary: Summary = {
  orders_count: 0,
  items_count: 0,
  items_with_staff_count: 0,
  items_without_staff_count: 0,
  total_item_amount: 0,
  total_staff_commission: 0,
  my_commission: 0,
}

export default function MyPosSummaryPage() {
  const [startDate, setStartDate] = useState(startOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [rows, setRows] = useState<DetailRow[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage] = useState(20)

  const loadData = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        page: String(page),
        per_page: String(perPage),
      })

      const res = await fetch(`/api/proxy/ecommerce/reports/my-pos-summary?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setSummary(emptySummary)
        setRows([])
        setCurrentPage(1)
        setLastPage(1)
        setTotal(0)
        return
      }

      const json = await res.json().catch(() => ({}))
      setSummary(json?.summary ?? emptySummary)
      setRows(Array.isArray(json?.data) ? json.data : [])
      setCurrentPage(Number(json?.meta?.current_page ?? 1))
      setLastPage(Number(json?.meta?.last_page ?? 1))
      setTotal(Number(json?.meta?.total ?? 0))
      setExpanded({})
    } finally {
      setLoading(false)
    }
  }, [endDate, perPage, startDate])

  useEffect(() => {
    loadData(1).catch(() => {})
  }, [loadData])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white" onClick={() => loadData(1)}>Apply</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Card label="Orders" value={String(summary.orders_count)} />
        <Card label="Items" value={String(summary.items_count)} />
        <Card label="With Staff" value={String(summary.items_with_staff_count)} />
        <Card label="Without Staff" value={String(summary.items_without_staff_count)} />
        <Card label="Total Amount" value={money(Number(summary.total_item_amount))} />
        <Card label="Total Staff Commission" value={money(Number(summary.total_staff_commission))} />
        <Card label="My Commission" value={money(Number(summary.my_commission))} />
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Order No</th>
              <th className="px-3 py-2 text-left">Order Date</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Item Total</th>
              <th className="px-3 py-2 text-left">Has Staff</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={7}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-3" colSpan={7}>No data.</td></tr>
            ) : rows.map((row) => (
              <Fragment key={row.order_item_id}>
                <tr className="border-t">
                  <td className="px-3 py-2">{row.order_no ?? row.order_id}</td>
                  <td className="px-3 py-2">{new Date(row.order_date).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.product_name ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{row.qty}</td>
                  <td className="px-3 py-2 text-right">{money(Number(row.item_total_price))}</td>
                  <td className="px-3 py-2">{row.has_staff_assignment ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    <button
                      className="text-blue-600"
                      onClick={() => setExpanded((prev) => ({ ...prev, [row.order_item_id]: !prev[row.order_item_id] }))}
                    >
                      {expanded[row.order_item_id] ? 'Hide splits' : 'View splits'}
                    </button>
                  </td>
                </tr>
                {expanded[row.order_item_id] && (
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2" colSpan={7}>
                      {row.staff_splits.length === 0 ? (
                        <div className="text-gray-500">No staff splits.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr>
                                <th className="px-2 py-1 text-left">Staff</th>
                                <th className="px-2 py-1 text-right">Share %</th>
                                <th className="px-2 py-1 text-right">Rate Snapshot</th>
                                <th className="px-2 py-1 text-right">Commission</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.staff_splits.map((split, idx) => (
                                <tr key={`${row.order_item_id}-${split.staff_id}-${idx}`}>
                                  <td className="px-2 py-1">{split.staff_name ?? (split.staff_id ? `#${split.staff_id}` : '-')}</td>
                                  <td className="px-2 py-1 text-right">{split.share_percent}%</td>
                                  <td className="px-2 py-1 text-right">{(Number(split.commission_rate_snapshot) * 100).toFixed(2)}%</td>
                                  <td className="px-2 py-1 text-right">{money(Number(split.staff_commission_amount))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t p-3 text-sm">
          <div>Total rows: {total}</div>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage <= 1} onClick={() => loadData(currentPage - 1)}>Prev</button>
            <span>Page {currentPage} / {lastPage}</span>
            <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={currentPage >= lastPage} onClick={() => loadData(currentPage + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
