'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type StaffOption = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
}

type SummaryRow = {
  staff_id: number
  staff_name: string
  commission_rate: number
  total_sales: number
  total_commission: number
  orders_count: number
  items_count: number
}

type DetailRow = {
  order_no: string | null
  order_id: number
  order_date: string
  product_name: string | null
  qty: number
  item_net_amount: number
  share_percent: number
  staff_item_sales: number
  commission_rate: number
  staff_item_commission: number
}

const money = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const today = new Date().toISOString().slice(0, 10)
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10)

export default function StaffCommissionReportPage() {
  const [startDate, setStartDate] = useState(startOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffId, setStaffId] = useState<number | ''>('')
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [grandTotalSales, setGrandTotalSales] = useState(0)
  const [grandTotalCommission, setGrandTotalCommission] = useState(0)
  const [loading, setLoading] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailStaff, setDetailStaff] = useState<SummaryRow | null>(null)
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedStaff = useMemo(
    () => staffOptions.find((option) => option.id === staffId),
    [staffOptions, staffId],
  )

  const loadStaffOptions = async (query: string) => {
    const qs = new URLSearchParams()
    qs.set('per_page', '20')
    if (query.trim()) qs.set('search', query.trim())

    const res = await fetch(`/api/proxy/staffs?${qs.toString()}`, { cache: 'no-store' })
    if (!res.ok) return

    const json = await res.json().catch(() => ({}))
    const list = Array.isArray(json?.data?.data) ? json.data.data : []
    const mapped: StaffOption[] = list.map((item: { id?: number; name?: string; email?: string | null; phone?: string | null; admin?: { email?: string | null } }) => ({
      id: Number(item.id),
      name: item.name ?? `Staff #${item.id}`,
      email: item.email ?? item.admin?.email ?? null,
      phone: item.phone ?? null,
    }))
    setStaffOptions(mapped)
  }

  const applyFilter = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ start_date: startDate, end_date: endDate })
      if (staffId) qs.set('staff_id', String(staffId))

      const res = await fetch(`/api/proxy/ecommerce/reports/staff-commission?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setRows([])
        setGrandTotalSales(0)
        setGrandTotalCommission(0)
        return
      }

      const json = await res.json().catch(() => ({}))
      setRows(Array.isArray(json?.rows) ? json.rows : [])
      setGrandTotalSales(Number(json?.grand_total_sales ?? 0))
      setGrandTotalCommission(Number(json?.grand_total_commission ?? 0))
    } finally {
      setLoading(false)
    }
  }, [endDate, staffId, startDate])

  useEffect(() => {
    loadStaffOptions('').catch(() => {})
  }, [])

  useEffect(() => {
    applyFilter().catch(() => {})
  }, [applyFilter])

  const openDetails = async (row: SummaryRow) => {
    setDetailOpen(true)
    setDetailStaff(row)
    setDetailLoading(true)
    try {
      const qs = new URLSearchParams({
        staff_id: String(row.staff_id),
        start_date: startDate,
        end_date: endDate,
        per_page: '100',
      })
      const res = await fetch(`/api/proxy/ecommerce/reports/staff-commission/detail?${qs.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setDetailRows([])
        return
      }

      const json = await res.json().catch(() => ({}))
      setDetailRows(Array.isArray(json?.data) ? json.data : [])
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-gray-600">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-gray-600">Staff (optional)</label>
            <div className="flex gap-2">
              <input
                placeholder="Search name / phone / email"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button className="rounded border px-3 py-2 text-sm" onClick={() => loadStaffOptions(staffSearch)}>Search</button>
            </div>
            <select
              className="mt-2 w-full rounded border px-3 py-2 text-sm"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All staff</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}{staff.phone ? ` • ${staff.phone}` : ''}{staff.email ? ` • ${staff.email}` : ''}
                </option>
              ))}
            </select>
            {selectedStaff && <p className="mt-1 text-xs text-gray-500">Selected: {selectedStaff.name}</p>}
          </div>
          <div className="flex items-end">
            <button className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={applyFilter}>Apply</button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b p-4 text-sm font-medium">Staff Commission Summary</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">Staff</th>
                <th className="px-4 py-2 text-left">Commission Rate</th>
                <th className="px-4 py-2 text-right">Total Sales</th>
                <th className="px-4 py-2 text-right">Total Commission</th>
                <th className="px-4 py-2 text-right">Orders Count</th>
                <th className="px-4 py-2 text-right">Items Count</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-3" colSpan={7}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-3" colSpan={7}>No data.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.staff_id} className="border-t">
                    <td className="px-4 py-2">{row.staff_name}</td>
                    <td className="px-4 py-2">{(Number(row.commission_rate) * 100).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right">{money(Number(row.total_sales))}</td>
                    <td className="px-4 py-2 text-right">{money(Number(row.total_commission))}</td>
                    <td className="px-4 py-2 text-right">{row.orders_count}</td>
                    <td className="px-4 py-2 text-right">{row.items_count}</td>
                    <td className="px-4 py-2">
                      <button className="text-blue-600" onClick={() => openDetails(row)}>View details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold">
                <td className="px-4 py-2" colSpan={2}>Grand Total</td>
                <td className="px-4 py-2 text-right">{money(grandTotalSales)}</td>
                <td className="px-4 py-2 text-right">{money(grandTotalCommission)}</td>
                <td className="px-4 py-2" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-semibold">Details — {detailStaff?.staff_name ?? '-'}</h3>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
            <div className="max-h-[75vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Order No</th>
                    <th className="px-3 py-2 text-left">Order Date</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Item Net</th>
                    <th className="px-3 py-2 text-right">Share %</th>
                    <th className="px-3 py-2 text-right">Staff Item Sales</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Staff Item Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr><td className="px-3 py-2" colSpan={9}>Loading...</td></tr>
                  ) : detailRows.length === 0 ? (
                    <tr><td className="px-3 py-2" colSpan={9}>No detail rows.</td></tr>
                  ) : (
                    detailRows.map((row, index) => (
                      <tr key={`${row.order_id}-${index}`} className="border-t">
                        <td className="px-3 py-2">{row.order_no ?? row.order_id}</td>
                        <td className="px-3 py-2">{new Date(row.order_date).toLocaleString()}</td>
                        <td className="px-3 py-2">{row.product_name ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{row.qty}</td>
                        <td className="px-3 py-2 text-right">{money(Number(row.item_net_amount))}</td>
                        <td className="px-3 py-2 text-right">{row.share_percent}%</td>
                        <td className="px-3 py-2 text-right">{money(Number(row.staff_item_sales))}</td>
                        <td className="px-3 py-2 text-right">{(Number(row.commission_rate) * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">{money(Number(row.staff_item_commission))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
