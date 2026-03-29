'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
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
  order_no: string
  order_datetime: string
  customer: string
  channel: string
  payment_method: string
  item_count: number
  product_amount: number
  discount: number
  net_amount: number
  status: string
}

type BookingRow = {
  order_no: string
  order_datetime: string
  customer: string
  channel: string
  payment_method: string
  type: string
  booking_no: string | null
  package_name: string | null
  gross_amount: number
  discount: number
  net_amount: number
  status: string
}

type EcommerceResponse = {
  summary?: {
    total_sales?: number
    online_sales?: number
    offline_sales?: number
    total_orders?: number
  }
  rows?: EcommerceRow[]
  totals_page?: {
    orders_count?: number
    product_amount?: number
    discount?: number
    net_amount?: number
  }
  grand_totals?: {
    orders_count?: number
    product_amount?: number
    discount?: number
    net_amount?: number
  }
  pagination?: Partial<Pagination>
}

type BookingResponse = {
  summary?: {
    total_booking_revenue?: number
    online_booking_revenue?: number
    offline_booking_revenue?: number
    total_transactions?: number
  }
  rows?: BookingRow[]
  totals_page?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
  }
  grand_totals?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
  }
  pagination?: Partial<Pagination>
}

const DEFAULT_PAGE_SIZE = 15
const DEFAULT_PAGE = 1
const PAGE_SIZE_OPTIONS = [15, 50, 100, 150, 200]

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: formatDateInput(start), to: formatDateInput(end) }
}

const formatDisplayDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatAmount = (amount: number) =>
  amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const labelize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

export default function SalesChannelReportPage({ mode, canExport = false }: { mode: Mode; canExport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(() => getDefaultRange(), [])

  const resolved = useMemo(() => {
    const parsedPage = Number(searchParams.get('page'))
    const parsedPerPage = Number(searchParams.get('per_page'))
    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      channel: searchParams.get('channel') ?? 'all',
      paymentMethod: searchParams.get('payment_method') ?? 'all',
      status: searchParams.get('status') ?? 'all',
      type: searchParams.get('type') ?? 'all',
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE,
      perPage: Number.isFinite(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : DEFAULT_PAGE_SIZE,
    }
  }, [searchParams, defaultRange.from, defaultRange.to])

  const [inputs, setInputs] = useState(resolved)
  const [ecommerceRows, setEcommerceRows] = useState<EcommerceRow[]>([])
  const [bookingRows, setBookingRows] = useState<BookingRow[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [totalsPage, setTotalsPage] = useState<Record<string, number>>({})
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({})
  const [pagination, setPagination] = useState<Pagination>({ total: 0, per_page: DEFAULT_PAGE_SIZE, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setInputs(resolved)
  }, [resolved])

  useEffect(() => {
    const controller = new AbortController()
    const fetchData = async () => {
      setLoading(true)
      const qs = new URLSearchParams()
      qs.set('date_from', resolved.dateFrom)
      qs.set('date_to', resolved.dateTo)
      qs.set('channel', resolved.channel)
      qs.set('page', String(resolved.page))
      qs.set('per_page', String(resolved.perPage))
      if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
      if (mode === 'ecommerce' && resolved.status !== 'all') qs.set('status', resolved.status)
      if (mode === 'booking' && resolved.type !== 'all') qs.set('type', resolved.type)

      const response = await fetch(`/api/proxy/ecommerce/reports/sales/${mode}?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        setEcommerceRows([])
        setBookingRows([])
        setSummary({})
        setTotalsPage({})
        setGrandTotals({})
        setPagination({ total: 0, per_page: resolved.perPage, current_page: 1, last_page: 1 })
        setLoading(false)
        return
      }

      const data: EcommerceResponse | BookingResponse = await response.json()
      setSummary((data.summary as Record<string, number>) ?? {})
      setTotalsPage((data.totals_page as Record<string, number>) ?? {})
      setGrandTotals((data.grand_totals as Record<string, number>) ?? {})
      setPagination({
        total: data.pagination?.total ?? 0,
        per_page: data.pagination?.per_page ?? resolved.perPage,
        current_page: data.pagination?.current_page ?? resolved.page,
        last_page: data.pagination?.last_page ?? 1,
      })
      if (mode === 'ecommerce') {
        setEcommerceRows((data.rows as EcommerceRow[]) ?? [])
      } else {
        setBookingRows((data.rows as BookingRow[]) ?? [])
      }
      setLoading(false)
    }

    void fetchData()
    return () => controller.abort()
  }, [mode, resolved])

  const paymentMethodOptions = useMemo(() => {
    const set = new Set<string>()
    ;(mode === 'ecommerce' ? ecommerceRows : bookingRows).forEach((row) => {
      if (row.payment_method) set.add(row.payment_method)
    })
    return ['all', ...Array.from(set).sort()]
  }, [mode, ecommerceRows, bookingRows])

  const updateQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(patch).forEach(([k, v]) => next.set(k, v))
    router.replace(`${pathname}?${next.toString()}`)
  }

  const handleApply = (e: FormEvent) => {
    e.preventDefault()
    updateQuery({
      date_from: inputs.dateFrom,
      date_to: inputs.dateTo,
      channel: inputs.channel,
      payment_method: inputs.paymentMethod,
      status: inputs.status,
      type: inputs.type,
      page: '1',
    })
  }

  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('date_from', resolved.dateFrom)
    qs.set('date_to', resolved.dateTo)
    qs.set('channel', resolved.channel)
    if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
    if (mode === 'ecommerce' && resolved.status !== 'all') qs.set('status', resolved.status)
    if (mode === 'booking' && resolved.type !== 'all') qs.set('type', resolved.type)
    return `/api/proxy/ecommerce/reports/sales/export/${mode}?${qs.toString()}`
  }, [mode, resolved])

  return (
    <div className="space-y-4">
      <form onSubmit={handleApply} className="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input type="date" value={inputs.dateFrom} onChange={(e) => setInputs((p) => ({ ...p, dateFrom: e.target.value }))} className="border rounded px-3 py-2" />
        <input type="date" value={inputs.dateTo} onChange={(e) => setInputs((p) => ({ ...p, dateTo: e.target.value }))} className="border rounded px-3 py-2" />
        <select value={inputs.channel} onChange={(e) => setInputs((p) => ({ ...p, channel: e.target.value }))} className="border rounded px-3 py-2">
          <option value="all">All Channel</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select value={inputs.paymentMethod} onChange={(e) => setInputs((p) => ({ ...p, paymentMethod: e.target.value }))} className="border rounded px-3 py-2">
          {paymentMethodOptions.map((option) => (
            <option key={option} value={option}>{option === 'all' ? 'All Payment Methods' : labelize(option)}</option>
          ))}
        </select>
        {mode === 'ecommerce' ? (
          <select value={inputs.status} onChange={(e) => setInputs((p) => ({ ...p, status: e.target.value }))} className="border rounded px-3 py-2">
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="completed">Completed</option>
          </select>
        ) : (
          <select value={inputs.type} onChange={(e) => setInputs((p) => ({ ...p, type: e.target.value }))} className="border rounded px-3 py-2">
            <option value="all">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="final_settlement">Final Settlement</option>
            <option value="package_purchase">Package Purchase</option>
          </select>
        )}
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Apply</button>
          {canExport && (
            <a href={exportUrl} className="px-4 py-2 bg-emerald-600 text-white rounded" target="_blank" rel="noreferrer">Export CSV</a>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {mode === 'ecommerce' ? (
          <>
            <Card label="Total Sales" value={summary.total_sales ?? 0} isCurrency />
            <Card label="Online Sales" value={summary.online_sales ?? 0} isCurrency />
            <Card label="Offline Sales" value={summary.offline_sales ?? 0} isCurrency />
            <Card label="Total Orders" value={summary.total_orders ?? 0} />
          </>
        ) : (
          <>
            <Card label="Total Booking Revenue" value={summary.total_booking_revenue ?? 0} isCurrency />
            <Card label="Online Booking Revenue" value={summary.online_booking_revenue ?? 0} isCurrency />
            <Card label="Offline Booking Revenue" value={summary.offline_booking_revenue ?? 0} isCurrency />
            <Card label="Total Transactions" value={summary.total_transactions ?? 0} />
          </>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              {mode === 'ecommerce' ? (
                <>
                  {['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Item Count', 'Product Amount', 'Discount', 'Net Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </>
              ) : (
                <>
                  {['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Type', 'Booking No', 'Package Name', 'Gross Amount', 'Discount', 'Net Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left">{h}</th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={mode === 'ecommerce' ? 10 : 12} />
            ) : mode === 'ecommerce' ? (
              ecommerceRows.length === 0 ? (
                <TableEmptyState colSpan={10} />
              ) : (
                ecommerceRows.map((row) => (
                  <tr key={`${row.order_no}-${row.order_datetime}`} className="border-t">
                    <td className="px-4 py-2">{row.order_no}</td>
                    <td className="px-4 py-2">{formatDisplayDateTime(row.order_datetime)}</td>
                    <td className="px-4 py-2">{row.customer}</td>
                    <td className="px-4 py-2">{labelize(row.channel)}</td>
                    <td className="px-4 py-2">{labelize(row.payment_method)}</td>
                    <td className="px-4 py-2">{row.item_count}</td>
                    <td className="px-4 py-2">{formatAmount(row.product_amount)}</td>
                    <td className="px-4 py-2">{formatAmount(row.discount)}</td>
                    <td className="px-4 py-2">{formatAmount(row.net_amount)}</td>
                    <td className="px-4 py-2">{labelize(row.status)}</td>
                  </tr>
                ))
              )
            ) : bookingRows.length === 0 ? (
              <TableEmptyState colSpan={12} />
            ) : (
              bookingRows.map((row, idx) => (
                <tr key={`${row.order_no}-${idx}`} className="border-t">
                  <td className="px-4 py-2">{row.order_no}</td>
                  <td className="px-4 py-2">{formatDisplayDateTime(row.order_datetime)}</td>
                  <td className="px-4 py-2">{row.customer}</td>
                  <td className="px-4 py-2">{labelize(row.channel)}</td>
                  <td className="px-4 py-2">{labelize(row.payment_method)}</td>
                  <td className="px-4 py-2">{labelize(row.type)}</td>
                  <td className="px-4 py-2">{row.booking_no ?? '—'}</td>
                  <td className="px-4 py-2">{row.package_name ?? '—'}</td>
                  <td className="px-4 py-2">{formatAmount(row.gross_amount)}</td>
                  <td className="px-4 py-2">{formatAmount(row.discount)}</td>
                  <td className="px-4 py-2">{formatAmount(row.net_amount)}</td>
                  <td className="px-4 py-2">{labelize(row.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-2 text-sm">
        <div className="font-semibold">Page Totals</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>Orders count: <strong>{(totalsPage.orders_count ?? 0).toLocaleString()}</strong></div>
          <div>{mode === 'ecommerce' ? 'Product Amount' : 'Gross Amount'}: <strong>{formatAmount(mode === 'ecommerce' ? (totalsPage.product_amount ?? 0) : (totalsPage.gross_amount ?? 0))}</strong></div>
          <div>Discount: <strong>{formatAmount(totalsPage.discount ?? 0)}</strong></div>
          <div>Net Amount: <strong>{formatAmount(totalsPage.net_amount ?? 0)}</strong></div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-2 text-sm">
        <div className="font-semibold">Grand Totals</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>Orders count: <strong>{(grandTotals.orders_count ?? 0).toLocaleString()}</strong></div>
          <div>{mode === 'ecommerce' ? 'Product Amount' : 'Gross Amount'}: <strong>{formatAmount(mode === 'ecommerce' ? (grandTotals.product_amount ?? 0) : (grandTotals.gross_amount ?? 0))}</strong></div>
          <div>Discount: <strong>{formatAmount(grandTotals.discount ?? 0)}</strong></div>
          <div>Net Amount: <strong>{formatAmount(grandTotals.net_amount ?? 0)}</strong></div>
        </div>
      </div>

      <PaginationControls
        currentPage={pagination.current_page}
        totalPages={pagination.last_page}
        pageSize={pagination.per_page}
        totalItems={pagination.total}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={(page) => updateQuery({ page: String(page) })}
        onPageSizeChange={(nextPageSize) => updateQuery({ per_page: String(nextPageSize), page: '1' })}
      />
    </div>
  )
}

function Card({ label, value, isCurrency = false }: { label: string; value: number; isCurrency?: boolean }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{isCurrency ? formatAmount(value) : value.toLocaleString()}</div>
    </div>
  )
}
