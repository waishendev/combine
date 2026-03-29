'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type Mode = 'ecommerce' | 'booking'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type EcommerceRow = {
  customer_id: number
  customer_name: string
  customer_email: string | null
  orders_count: number
  items_count: number
  revenue: number
  cogs: number
  gross_profit: number
}

type BookingRow = {
  customer_id: number
  customer_name: string
  customer_email: string | null
  transactions_count: number
  booking_deposit_amount: number
  booking_settlement_amount: number
  package_purchase_amount: number
  total_revenue: number
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const DEFAULT_TOP_COUNT = 5
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]
const TOP_N_OPTIONS = [5, 10, 20, 50]

const formatDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getDefaultRange = () => {
  const now = new Date()
  return {
    from: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

const formatDisplayDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString || '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

const formatAmount = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CustomerSalesDomainReportPage({ mode, canExport = false }: { mode: Mode; canExport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(() => getDefaultRange(), [])

  const resolved = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    const parsedTop = Number(searchParams.get('top'))

    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      customer: searchParams.get('customer') ?? '',
      paymentMethod: searchParams.get('payment_method') ?? 'all',
      status: searchParams.get('status') ?? 'all',
      channel: searchParams.get('channel') ?? 'all',
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE,
      perPage: Number.isFinite(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : DEFAULT_PAGE_SIZE,
      top: Number.isFinite(parsedTop) && parsedTop > 0 ? parsedTop : DEFAULT_TOP_COUNT,
    }
  }, [defaultRange.from, defaultRange.to, searchParams])

  const [inputs, setInputs] = useState(resolved)
  const [rows, setRows] = useState<EcommerceRow[] | BookingRow[]>([])
  const [tops, setTops] = useState<EcommerceRow[] | BookingRow[]>([])
  const [totalsPage, setTotalsPage] = useState<Record<string, number>>({})
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({})
  const [pagination, setPagination] = useState<Pagination>({ total: 0, per_page: DEFAULT_PAGE_SIZE, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => setInputs(resolved), [resolved])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set('date_from', resolved.dateFrom)
      qs.set('date_to', resolved.dateTo)
      qs.set('page', String(resolved.page))
      qs.set('per_page', String(resolved.perPage))
      qs.set('top', String(resolved.top))
      qs.set('channel', resolved.channel)
      if (resolved.customer) qs.set('customer', resolved.customer)
      if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
      if (resolved.status !== 'all') qs.set('status', resolved.status)

      const response = await fetch(`/api/proxy/ecommerce/reports/sales/customers-${mode}?${qs.toString()}`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) {
        setRows([])
        setTops([])
        setTotalsPage({})
        setGrandTotals({})
        setPagination({ total: 0, per_page: resolved.perPage, current_page: 1, last_page: 1 })
        setLoading(false)
        return
      }

      const data = await response.json()
      setRows(data.rows ?? [])
      setTops(data.tops ?? [])
      setTotalsPage(data.totals_page ?? {})
      setGrandTotals(data.grand_totals ?? {})
      setPagination({
        total: data.pagination?.total ?? 0,
        per_page: data.pagination?.per_page ?? resolved.perPage,
        current_page: data.pagination?.current_page ?? resolved.page,
        last_page: data.pagination?.last_page ?? 1,
      })
      setLoading(false)
    }

    void run()
    return () => controller.abort()
  }, [mode, resolved])

  const updateQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(patch).forEach(([k, v]) => next.set(k, v))
    router.push(`${pathname}?${next.toString()}`)
  }

  const handleApply = () => {
    updateQuery({
      date_from: inputs.dateFrom,
      date_to: inputs.dateTo,
      customer: inputs.customer,
      payment_method: inputs.paymentMethod,
      status: inputs.status,
      channel: inputs.channel,
      top: String(inputs.top),
      page: '1',
    })
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    updateQuery({ date_from: defaultRange.from, date_to: defaultRange.to, customer: '', payment_method: 'all', status: 'all', channel: 'all', top: String(DEFAULT_TOP_COUNT), page: '1' })
    setIsFilterOpen(false)
  }

  const showingRange = `${formatDisplayDate(resolved.dateFrom)} – ${formatDisplayDate(resolved.dateTo)}`
  const activeFilters = [
    { label: 'Date Range', value: showingRange },
    ...(resolved.customer ? [{ label: 'Customer', value: resolved.customer }] : []),
    ...(resolved.paymentMethod !== 'all' ? [{ label: 'Payment', value: resolved.paymentMethod }] : []),
    ...(resolved.status !== 'all' ? [{ label: 'Status', value: resolved.status }] : []),
    ...(resolved.channel !== 'all' ? [{ label: 'Channel', value: resolved.channel }] : []),
  ]

  const exportUrl = `/api/proxy/ecommerce/reports/sales/export/customers-${mode}?${new URLSearchParams({
    date_from: resolved.dateFrom,
    date_to: resolved.dateTo,
    channel: resolved.channel,
    ...(resolved.customer ? { customer: resolved.customer } : {}),
    ...(resolved.paymentMethod !== 'all' ? { payment_method: resolved.paymentMethod } : {}),
    ...(resolved.status !== 'all' ? { status: resolved.status } : {}),
  }).toString()}`

  return (
    <div className="space-y-6">
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4"><h2 className="text-lg font-semibold">Filter</h2><button type="button" onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none"><i className="fa-solid fa-xmark" /></button></div>
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <input type="date" value={inputs.dateFrom} onChange={(e) => setInputs((p) => ({ ...p, dateFrom: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" />
              <input type="date" value={inputs.dateTo} onChange={(e) => setInputs((p) => ({ ...p, dateTo: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" />
              <input type="text" placeholder="Customer name or email" value={inputs.customer} onChange={(e) => setInputs((p) => ({ ...p, customer: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" />
              <select value={inputs.paymentMethod} onChange={(e) => setInputs((p) => ({ ...p, paymentMethod: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm"><option value="all">All Payment Methods</option><option value="cash">Cash</option><option value="card">Card</option><option value="online_banking">Online Banking</option></select>
              <select value={inputs.status} onChange={(e) => setInputs((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm"><option value="all">All Statuses</option><option value="paid">Paid</option><option value="packed">Packed</option><option value="shipped">Shipped</option><option value="completed">Completed</option></select>
              <select value={inputs.channel} onChange={(e) => setInputs((p) => ({ ...p, channel: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm"><option value="all">All Channels</option><option value="online">Online</option><option value="offline">Offline</option></select>
              <select value={inputs.top} onChange={(e) => setInputs((p) => ({ ...p, top: Number(e.target.value) }))} className="h-10 rounded border border-slate-200 px-3 text-sm">{TOP_N_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            </div>
            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3"><button type="button" onClick={handleReset} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200">Reset</button><button type="button" onClick={handleApply} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">Apply Filter</button></div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <button type="button" onClick={() => setIsFilterOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"><i className="fa-solid fa-filter" />Filter</button>
        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">Show</label>
          <select id="pageSize" value={resolved.perPage} onChange={(event) => updateQuery({ per_page: event.target.value, page: '1' })} className="border border-gray-300 rounded px-2 py-1 text-sm">{PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          {canExport && <a href={exportUrl} className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"><i className="fa-solid fa-download" />Export CSV</a>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">{activeFilters.map((filter) => <span key={`${filter.label}-${filter.value}`} className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"><span className="font-medium">{filter.label}</span><span>{filter.value}</span></span>)}</div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Top {resolved.top} Customers</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? <div className="col-span-full text-sm text-slate-400">Loading top performers...</div> : tops.length === 0 ? <div className="col-span-full text-sm text-slate-400">No top results found.</div> : tops.map((row) => (
            <div key={`${row.customer_id}-${row.customer_name}`} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">Customer</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{row.customer_name}</p>
              <p className="text-xs text-slate-500">{row.customer_email ?? '—'}</p>
              <p className="text-xs font-semibold uppercase text-slate-400 mt-2">Revenue</p>
              <p className="text-lg font-semibold text-slate-700">RM {formatAmount(mode === 'ecommerce' ? (row as EcommerceRow).revenue : (row as BookingRow).total_revenue)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70"><tr>{mode === 'ecommerce' ? ['Customer', 'Email', 'Orders', 'Items', 'Revenue', 'COGS', 'Gross Profit'].map((h) => <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">{h}</th>) : ['Customer', 'Email', 'Transactions', 'Booking Deposit Amount', 'Booking Settlement Amount', 'Package Purchase Amount', 'Total Revenue'].map((h) => <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <TableLoadingRow colSpan={7} /> : rows.length === 0 ? <TableEmptyState colSpan={7} /> : mode === 'ecommerce' ? (rows as EcommerceRow[]).map((row) => <tr key={row.customer_id}><td className="px-4 py-2 border border-gray-200 font-medium">{row.customer_name}</td><td className="px-4 py-2 border border-gray-200">{row.customer_email ?? '—'}</td><td className="px-4 py-2 border border-gray-200">{row.orders_count}</td><td className="px-4 py-2 border border-gray-200">{row.items_count}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.revenue)}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.cogs)}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.gross_profit)}</td></tr>) : (rows as BookingRow[]).map((row) => <tr key={row.customer_id}><td className="px-4 py-2 border border-gray-200 font-medium">{row.customer_name}</td><td className="px-4 py-2 border border-gray-200">{row.customer_email ?? '—'}</td><td className="px-4 py-2 border border-gray-200">{row.transactions_count}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.booking_deposit_amount)}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.booking_settlement_amount)}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.package_purchase_amount)}</td><td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.total_revenue)}</td></tr>)}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold"><td className="border border-gray-300 px-4 py-2 text-left">Page Totals</td><td className="border border-gray-300 px-4 py-2">—</td><td className="border border-gray-300 px-4 py-2">—</td>{mode === 'ecommerce' ? <><td className="border border-gray-300 px-4 py-2">—</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.revenue ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.cogs ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.gross_profit ?? 0)}</td></> : <><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.booking_deposit_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.booking_settlement_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.package_purchase_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.total_revenue ?? 0)}</td></>}</tr>
            <tr className="bg-gray-100 font-bold"><td className="border border-gray-300 px-4 py-2 text-left">Grand Totals</td><td className="border border-gray-300 px-4 py-2">—</td><td className="border border-gray-300 px-4 py-2">—</td>{mode === 'ecommerce' ? <><td className="border border-gray-300 px-4 py-2">—</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.revenue ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.cogs ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.gross_profit ?? 0)}</td></> : <><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.booking_deposit_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.booking_settlement_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.package_purchase_amount ?? 0)}</td><td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.total_revenue ?? 0)}</td></>}</tr>
          </tfoot>
        </table>
      </div>

      <PaginationControls currentPage={pagination.current_page} totalPages={pagination.last_page} pageSize={pagination.per_page} onPageChange={(page) => updateQuery({ page: String(page) })} disabled={loading} />
    </div>
  )
}
