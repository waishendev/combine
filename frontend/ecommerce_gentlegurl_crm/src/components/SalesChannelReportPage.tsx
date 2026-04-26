'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import OfflineOrderActions from './reports/OfflineOrderActions'

type Mode = 'ecommerce' | 'booking'

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type EcommerceRow = {
  order_id: number
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
  order_id: number
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
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
  }
  rows?: BookingRow[]
  totals_page?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
  }
  grand_totals?: {
    orders_count?: number
    gross_amount?: number
    discount?: number
    net_amount?: number
    booking_deposit_amount?: number
    booking_settlement_amount?: number
    addon_revenue?: number
    package_purchase_amount?: number
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

const getTodayRange = () => {
  const d = formatDateInput(new Date())
  return { from: d, to: d }
}

const formatDisplayDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString || '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
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

/** Table display: match gateway / order `payment_method` keys to readable labels. */
const PAYMENT_METHOD_TABLE_LABELS: Record<string, string> = {
  billplz_online_banking: 'Online Banking (Billplz)',
  billplz_fpx: 'Online Banking (Billplz)',
  billplz_credit_card: 'Credit Card (Billplz)',
  billplz_card: 'Credit Card (Billplz)',
}

const paymentMethodDisplayLabel = (raw: string) => {
  const key = (raw ?? '').trim().toLowerCase()
  if (!key) return '—'
  return PAYMENT_METHOD_TABLE_LABELS[key] ?? labelize(raw)
}

const normalizeBookingType = (value?: string | null) => String(value ?? '').trim().toLowerCase()
const isBookingDepositType = (value?: string | null) => {
  const t = normalizeBookingType(value)
  return t === 'booking_deposit' || t === 'deposit'
}
const isBookingWorkerType = (value?: string | null) => {
  const t = normalizeBookingType(value)
  return t === 'final_settlement' || t === 'booking_settlement' || t === 'settlement_services' || t === 'settlement_service'
}

/** Table header: only the first character is uppercase (no full-string caps). */
const reportTableColumnHeader = (label: string) =>
  label ? `${label.charAt(0).toUpperCase()}${label.slice(1).toLowerCase()}` : label

export default function SalesChannelReportPage({
  mode,
  canExport = false,
  defaultDatePreset = 'month',
  paramPrefix,
  isAllWorkspace = false,
  lockedChannel,
}: {
  mode: Mode
  canExport?: boolean
  defaultDatePreset?: 'month' | 'today'
  /** When set (e.g. `ec_`), URL uses `{prefix}page` and `{prefix}per_page` instead of `page` / `per_page`. */
  paramPrefix?: string
  /** When true with `paramPrefix`, filter apply/reset also resets the sibling table pages (`ec_page` / `bk_page`). */
  isAllWorkspace?: boolean
  /** When set, forces channel and hides channel selector. */
  lockedChannel?: 'online' | 'offline'
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultRange = useMemo(
    () => (defaultDatePreset === 'today' ? getTodayRange() : getDefaultRange()),
    [defaultDatePreset],
  )

  const pageKey = paramPrefix ? `${paramPrefix}page` : 'page'
  const perPageKey = paramPrefix ? `${paramPrefix}per_page` : 'per_page'

  const resolved = useMemo(() => {
    const parsedPage = Number(searchParams.get(pageKey))
    const parsedPerPage = Number(searchParams.get(perPageKey))
    const defaultChannel = mode === 'ecommerce' ? 'online' : 'all'
    const channel = lockedChannel ?? (searchParams.get('channel') ?? defaultChannel)
    return {
      dateFrom: searchParams.get('date_from') ?? defaultRange.from,
      dateTo: searchParams.get('date_to') ?? defaultRange.to,
      channel,
      paymentMethod: searchParams.get('payment_method') ?? 'all',
      status: searchParams.get('status') ?? 'all',
      type: searchParams.get('type') ?? 'all',
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE,
      perPage: Number.isFinite(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : DEFAULT_PAGE_SIZE,
    }
  }, [lockedChannel, mode, searchParams, defaultRange.from, defaultRange.to, pageKey, perPageKey])

  const [inputs, setInputs] = useState(resolved)
  const [ecommerceRows, setEcommerceRows] = useState<EcommerceRow[]>([])
  const [bookingRows, setBookingRows] = useState<BookingRow[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [totalsPage, setTotalsPage] = useState<Record<string, number>>({})
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({})
  const [pagination, setPagination] = useState<Pagination>({ total: 0, per_page: DEFAULT_PAGE_SIZE, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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
      qs.set('channel', lockedChannel ?? resolved.channel)
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
  }, [mode, resolved, refreshKey])

  const updateQuery = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(patch).forEach(([k, v]) => next.set(k, v))
    router.push(`${pathname}?${next.toString()}`)
  }

  const handleApply = () => {
    const patch: Record<string, string> = {
      date_from: inputs.dateFrom,
      date_to: inputs.dateTo,
      channel: lockedChannel ?? inputs.channel,
      payment_method: inputs.paymentMethod,
      status: inputs.status,
      type: inputs.type,
    }
    if (paramPrefix) {
      patch[pageKey] = '1'
      if (isAllWorkspace) {
        patch.ec_page = '1'
        patch.bk_page = '1'
      }
    } else {
      patch.page = '1'
    }
    updateQuery(patch)
    setIsFilterOpen(false)
  }

  const handleReset = () => {
    const range = defaultDatePreset === 'today' ? getTodayRange() : defaultRange
    const patch: Record<string, string> = {
      date_from: range.from,
      date_to: range.to,
      channel: lockedChannel ?? 'all',
      payment_method: 'all',
      status: 'all',
      type: 'all',
    }
    if (paramPrefix) {
      patch[pageKey] = '1'
      if (isAllWorkspace) {
        patch.ec_page = '1'
        patch.bk_page = '1'
      }
    } else {
      patch.page = '1'
    }
    updateQuery(patch)
    setIsFilterOpen(false)
  }

  const showingRange = `${formatDisplayDate(resolved.dateFrom)} – ${formatDisplayDate(resolved.dateTo)}`
  const activeFilters = [
    { label: 'Date Range', value: showingRange },
    ...(lockedChannel ? [{ label: 'Channel', value: labelize(lockedChannel) }] : resolved.channel !== 'all' ? [{ label: 'Channel', value: labelize(resolved.channel) }] : []),
    ...(resolved.paymentMethod !== 'all' ? [{ label: 'Payment', value: labelize(resolved.paymentMethod) }] : []),
    ...(mode === 'ecommerce' && resolved.status !== 'all' ? [{ label: 'Status', value: labelize(resolved.status) }] : []),
    ...(mode === 'booking' && resolved.type !== 'all' ? [{ label: 'Type', value: labelize(resolved.type) }] : []),
  ]

  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('date_from', resolved.dateFrom)
    qs.set('date_to', resolved.dateTo)
    qs.set('channel', lockedChannel ?? resolved.channel)
    if (resolved.paymentMethod !== 'all') qs.set('payment_method', resolved.paymentMethod)
    if (mode === 'ecommerce' && resolved.status !== 'all') qs.set('status', resolved.status)
    if (mode === 'booking' && resolved.type !== 'all') qs.set('type', resolved.type)
    return `/api/proxy/ecommerce/reports/sales/export/${mode}?${qs.toString()}`
  }, [mode, resolved])

  const ecColSpan = 11
  const bkColSpan = 13

  return (
    <div className="space-y-6">
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" aria-label="Close">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-5 grid gap-4 sm:grid-cols-2">
              <input
                type="date"
                value={inputs.dateFrom}
                onChange={(e) => setInputs((p) => ({ ...p, dateFrom: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm"
              />
              <input
                type="date"
                value={inputs.dateTo}
                onChange={(e) => setInputs((p) => ({ ...p, dateTo: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm"
              />
              {lockedChannel ? null : (
                <select
                  value={inputs.channel}
                  onChange={(e) => setInputs((p) => ({ ...p, channel: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm"
                >
                  <option value="all">All Channels</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              )}
              <select
                value={inputs.paymentMethod}
                onChange={(e) => setInputs((p) => ({ ...p, paymentMethod: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online_banking">Online Banking</option>
              </select>
              {mode === 'ecommerce' ? (
                <select
                  value={inputs.status}
                  onChange={(e) => setInputs((p) => ({ ...p, status: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm sm:col-span-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <select
                  value={inputs.type}
                  onChange={(e) => setInputs((p) => ({ ...p, type: e.target.value }))}
                  className="h-10 rounded border border-slate-200 px-3 text-sm sm:col-span-2"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">Deposit</option>
                  <option value="final_settlement">Final Settlement</option>
                  <option value="addon">Add-on</option>
                  <option value="package_purchase">Package Purchase</option>
                </select>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
              <button type="button" onClick={handleReset} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200">
                Reset
              </button>
              <button type="button" onClick={handleApply} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700">
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <button type="button" onClick={() => setIsFilterOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2">
          <i className="fa-solid fa-filter" />
          Filter
        </button>
        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="pageSize"
            value={resolved.perPage}
            onChange={(event) => updateQuery({ [perPageKey]: event.target.value, [pageKey]: '1' })}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {canExport && (
            <a href={exportUrl} className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" target="_blank" rel="noreferrer">
              <i className="fa-solid fa-download" />
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {activeFilters.map((filter) => (
          <span key={`${filter.label}-${filter.value}`} className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
            <span className="font-medium">{filter.label}</span>
            <span>{filter.value}</span>
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Summary</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {mode === 'ecommerce' ? (
            <>
              <SummaryCard label="Total Sales" value={`RM ${formatAmount(summary.total_sales ?? 0)}`} />
              <SummaryCard label="Online Sales" value={`RM ${formatAmount(summary.online_sales ?? 0)}`} />
              <SummaryCard label="Offline Sales" value={`RM ${formatAmount(summary.offline_sales ?? 0)}`} />
              <SummaryCard label="Total Orders" value={(summary.total_orders ?? 0).toLocaleString()} />
            </>
          ) : (
            <>
              <SummaryCard label="Total Booking Revenue" value={`RM ${formatAmount(summary.total_booking_revenue ?? 0)}`} />
              <SummaryCard label="Booking Deposit Amount" value={`RM ${formatAmount(summary.booking_deposit_amount ?? 0)}`} />
              <SummaryCard label="Booking Settlement Amount" value={`RM ${formatAmount(summary.booking_settlement_amount ?? 0)}`} />
              <SummaryCard label="Add-on Revenue" value={`RM ${formatAmount(summary.addon_revenue ?? 0)}`} />
              <SummaryCard label="Package Purchase Amount" value={`RM ${formatAmount(summary.package_purchase_amount ?? 0)}`} />
            </>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {mode === 'ecommerce' ? (
                ['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Item Count', 'Product Amount', 'Discount', 'Net Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600">
                    {reportTableColumnHeader(h)}
                  </th>
                ))
              ) : (
                ['Order No', 'Date/Time', 'Customer', 'Channel', 'Payment Method', 'Type', 'Booking No', 'Name', 'Gross Amount', 'Discount', 'Net Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2 font-semibold text-left text-gray-600">
                    {reportTableColumnHeader(h)}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={mode === 'ecommerce' ? ecColSpan : bkColSpan} />
            ) : mode === 'ecommerce' ? (
              ecommerceRows.length === 0 ? (
                <TableEmptyState colSpan={ecColSpan} />
              ) : (
                ecommerceRows.map((row) => (
                  <tr key={`${row.order_no}-${row.order_datetime}`}>
                    <td className="px-4 py-2 border border-gray-200">{row.order_no}</td>
                    <td className="px-4 py-2 border border-gray-200">{formatDisplayDateTime(row.order_datetime)}</td>
                    <td className="px-4 py-2 border border-gray-200 font-medium">{row.customer}</td>
                    <td className="px-4 py-2 border border-gray-200">{labelize(row.channel)}</td>
                    <td className="px-4 py-2 border border-gray-200">{paymentMethodDisplayLabel(row.payment_method)}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.item_count}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.product_amount)}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.discount)}</td>
                    <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.net_amount)}</td>
                    <td className="px-4 py-2 border border-gray-200">{labelize(row.status)}</td>
                    <td className="px-4 py-2 border border-gray-200 text-center">
                      <OfflineOrderActions
                        orderId={row.order_id}
                        channel={row.channel}
                        currentPaymentMethod={row.payment_method}
                        onDone={() => setRefreshKey((prev) => prev + 1)}
                      />
                    </td>
                  </tr>
                ))
              )
            ) : bookingRows.length === 0 ? (
              <TableEmptyState colSpan={bkColSpan} />
            ) : (
              bookingRows.map((row, idx) => (
                <tr key={`${row.order_no}-${idx}`}>
                  <td className="px-4 py-2 border border-gray-200">{row.order_no}</td>
                  <td className="px-4 py-2 border border-gray-200">{formatDisplayDateTime(row.order_datetime)}</td>
                  <td className="px-4 py-2 border border-gray-200 font-medium">{row.customer}</td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.channel)}</td>
                  <td className="px-4 py-2 border border-gray-200">{paymentMethodDisplayLabel(row.payment_method)}</td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.type)}</td>
                  <td className="px-4 py-2 border border-gray-200">{row.booking_no ?? '—'}</td>
                  <td className="px-4 py-2 border border-gray-200">{row.package_name ?? '—'}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.gross_amount)}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.discount)}</td>
                  <td className="px-4 py-2 border border-gray-200">RM {formatAmount(row.net_amount)}</td>
                  <td className="px-4 py-2 border border-gray-200">{labelize(row.status)}</td>
                  <td className="px-4 py-2 border border-gray-200 text-center">
                    <OfflineOrderActions
                      orderId={row.order_id}
                      channel={row.channel}
                      currentPaymentMethod={row.payment_method}
                      staffActionLabel={isBookingWorkerType(row.type) ? 'worker' : 'sales_person'}
                      hideStaffAction={isBookingDepositType(row.type)}
                      onDone={() => setRefreshKey((prev) => prev + 1)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            {mode === 'ecommerce' ? (
              <>
                <tr className="bg-gray-100 font-semibold">
                  <td className="border border-gray-300 px-4 py-2 text-left">Page Totals</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">{(totalsPage.orders_count ?? 0).toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.product_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-4 py-2 text-left">Grand Totals</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">{(grandTotals.orders_count ?? 0).toLocaleString()}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.product_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.discount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.net_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
              </>
            ) : (
              <>
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={5} className="border border-gray-300 px-4 py-2 text-left">
                    Page Totals
                    {/* <span className="ml-2 font-normal text-gray-600">
                      ({(totalsPage.orders_count ?? 0).toLocaleString()} on this page)
                    </span> */}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.booking_deposit_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(totalsPage.booking_settlement_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount((totalsPage.addon_revenue ?? 0) + (totalsPage.package_purchase_amount ?? 0))}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={5} className="border border-gray-300 px-4 py-2 text-left">
                    Grand Totals
                    {/* <span className="ml-2 font-normal text-gray-600">
                      ({(grandTotals.orders_count ?? 0).toLocaleString()} total)
                    </span> */}
                  </td>
                  <td className="border border-gray-300 px-4 py-2"></td>
                  <td className="border border-gray-300 px-4 py-2"></td>
                  <td className="border border-gray-300 px-4 py-2"></td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.booking_deposit_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount(grandTotals.booking_settlement_amount ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2">RM {formatAmount((grandTotals.addon_revenue ?? 0) + (grandTotals.package_purchase_amount ?? 0))}</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                  <td className="border border-gray-300 px-4 py-2">—</td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      <PaginationControls
        currentPage={pagination.current_page}
        totalPages={pagination.last_page}
        pageSize={pagination.per_page}
        onPageChange={(page) => updateQuery({ [pageKey]: String(page) })}
        disabled={loading}
      />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-700">{value}</p>
    </div>
  )
}
