'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import BookingAppointmentDrawer from '@/components/booking/BookingAppointmentDrawer'
import OrderViewPanel from '@/components/OrderViewPanel'
import StatusBadge from '@/components/StatusBadge'

type HistoryResponse = {
  data?: {
    customer_summary?: {
      id: number
      name: string
      phone?: string | null
      email?: string | null
      customer_type?: string | null
      total_spent?: number
      total_orders_bookings?: number
      last_activity_date?: string | null
    }
    ecommerce_orders?: HistoryOrder[]
    pos_orders?: HistoryPosOrder[]
    booking_appointments?: HistoryBooking[]
    service_packages?: HistoryPackage[]
  }
}

type HistoryOrder = {
  id: number
  order_number?: string | null
  date?: string | null
  status?: string | null
  total_amount?: number | null
}

type HistoryPosOrder = {
  id: number
  receipt_number?: string | null
  date?: string | null
  payment_method?: string | null
  status?: string | null
  total_amount?: number | null
}

type HistoryBooking = {
  id: number
  booking_no?: string | null
  date_time?: string | null
  service_names?: string[]
  staff?: string | null
  status?: string | null
  amount?: number | null
}

type HistoryPackage = {
  id: number
  package_name?: string | null
  purchase_date?: string | null
  remaining_sessions?: number | null
  status?: string | null
  started_at?: string | null
  expires_at?: string | null
  purchased_from?: string | null
  purchased_ref_id?: number | null
  usage_count?: number | null
  package_description?: string | null
  balances?: Array<{
    booking_service_id: number
    service_name?: string | null
    total_qty?: number
    used_qty?: number
    remaining_qty?: number
  }>
}

type TabKey = 'all' | 'ecommerce' | 'booking'

type DrawerState =
  | { type: 'order'; orderId: number }
  | { type: 'booking'; bookingId: number }
  | { type: 'package'; data: HistoryPackage }

type CustomerDetailBrief = {
  id?: number
  name?: string | null
  email?: string | null
  phone?: string | null
  customer_type?: string | null
  tier?: string | null
  is_active?: boolean | null
  loyalty_summary?: {
    available_points: number
  } | null
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ecommerce', label: 'Ecommerce' },
  { key: 'booking', label: 'Booking' },
]

function formatDate(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatAmount(value?: number | null) {
  if (value == null) return '-'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(value)
}

function PackageDetailsDrawer({ data, onClose }: { data: HistoryPackage; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hidden w-full md:block" />
      <aside
        className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Service Package Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Package Info</h4>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div><dt className="text-slate-500">Package Name</dt><dd className="font-semibold">{data.package_name ?? '-'}</dd></div>
              <div><dt className="text-slate-500">Status</dt><dd className="font-semibold">{data.status ?? '-'}</dd></div>
              <div><dt className="text-slate-500">Purchase Date</dt><dd className="font-semibold">{formatDate(data.purchase_date)}</dd></div>
              <div><dt className="text-slate-500">Start Date</dt><dd className="font-semibold">{formatDate(data.started_at)}</dd></div>
              <div><dt className="text-slate-500">Expiry Date</dt><dd className="font-semibold">{formatDate(data.expires_at)}</dd></div>
              <div><dt className="text-slate-500">Usage Count</dt><dd className="font-semibold">{data.usage_count ?? 0}</dd></div>
              <div><dt className="text-slate-500">Remaining Sessions</dt><dd className="font-semibold">{data.remaining_sessions ?? 0}</dd></div>
              <div><dt className="text-slate-500">Purchased From</dt><dd className="font-semibold">{data.purchased_from ?? '-'}</dd></div>
            </dl>
            {data.package_description ? <p className="mt-3 text-sm text-slate-700">{data.package_description}</p> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Service Balance Breakdown</h4>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Used</th>
                  <th className="px-3 py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {(data.balances ?? []).map((balance) => (
                  <tr key={balance.booking_service_id} className="border-t">
                    <td className="px-3 py-2">{balance.service_name ?? '-'}</td>
                    <td className="px-3 py-2">{balance.total_qty ?? 0}</td>
                    <td className="px-3 py-2">{balance.used_qty ?? 0}</td>
                    <td className="px-3 py-2">{balance.remaining_qty ?? 0}</td>
                  </tr>
                ))}
                {(data.balances ?? []).length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={4}>
                      No package balance breakdown available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </div>
      </aside>
    </div>
  )
}

export default function CustomerHistoryPage({ customerId }: { customerId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<HistoryResponse['data']>()
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailBrief | null>(null)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [ecommerceTx, setEcommerceTx] = useState<
    Array<{
      order_id: number
      order_no: string
      order_datetime: string
      payment_method: string
      status: string
      net_amount: number
    }>
  >([])
  const [bookingTx, setBookingTx] = useState<
    Array<{
      order_id: number
      order_no: string
      order_datetime: string
      payment_method: string
      status: string
      type: string
      booking_id?: number | null
      booking_no?: string | null
      package_name?: string | null
      net_amount: number
    }>
  >([])

  const formatYmd = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Re-fetch whenever date filter query changes.
  const dateFromQuery = searchParams.get('date_from') ?? ''
  const dateToQuery = searchParams.get('date_to') ?? ''
  const filterKey = `${dateFromQuery}|${dateToQuery}`

  useEffect(() => {
    const controller = new AbortController()

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const dateFromParam = dateFromQuery.trim()
        const dateToParam = dateToQuery.trim()
        const hasRange = Boolean(dateFromParam && dateToParam)

        const to = hasRange ? dateToParam : formatYmd(new Date())
        const from = hasRange ? dateFromParam : '2000-01-01'

        const qs = new URLSearchParams()
        qs.set('date_from', from)
        qs.set('date_to', to)
        qs.set('per_page', '200')
        qs.set('page', '1')
        qs.set('customer_id', customerId)

        const [ecommerceResponse, bookingResponse, customerResponse] = await Promise.all([
          fetch(`/api/proxy/ecommerce/reports/sales/ecommerce?${qs.toString()}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`/api/proxy/ecommerce/reports/sales/booking?${qs.toString()}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch(`/api/proxy/customers/${customerId}`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: { Accept: 'application/json', 'Accept-Language': 'en' },
          }),
        ])

        if (!ecommerceResponse.ok || !bookingResponse.ok) {
          throw new Error('Failed to load customer history.')
        }

        type EcommerceRow = {
          order_id: number
          order_no: string
          order_datetime: string
          payment_method: string
          status: string
          net_amount: number
        }

        type BookingRow = {
          order_id: number
          order_no: string
          order_datetime: string
          payment_method: string
          status: string
          type: string
          booking_id?: number | null
          booking_no?: string | null
          package_name?: string | null
          net_amount: number
        }

        const ecommerceJson = (await ecommerceResponse.json().catch(() => null)) as { rows?: EcommerceRow[] } | null
        const bookingJson = (await bookingResponse.json().catch(() => null)) as { rows?: BookingRow[] } | null
        const ecRows = Array.isArray(ecommerceJson?.rows) ? ecommerceJson!.rows! : []
        const bkRows = Array.isArray(bookingJson?.rows) ? bookingJson!.rows! : []

        setEcommerceTx(ecRows)
        setBookingTx(bkRows)

        const parseTime = (value?: string | null) => {
          if (!value) return null
          const d = new Date(value)
          const t = d.getTime()
          return Number.isNaN(t) ? null : t
        }

        const latestActivityMs = Math.max(
          0,
          ...ecRows.map((r) => parseTime(r.order_datetime) ?? 0),
          ...bkRows.map((r) => parseTime(r.order_datetime) ?? 0),
        )

        const totalSpent =
          ecRows.reduce((sum, r) => sum + Number(r.net_amount ?? 0), 0) +
          bkRows.reduce((sum, r) => sum + Number(r.net_amount ?? 0), 0)

        const totalOrdersBookings = ecRows.length + bkRows.length

        let customerJson: { data?: CustomerDetailBrief } | null = null
        if (customerResponse.ok) {
          customerJson = (await customerResponse.json().catch(() => null)) as
            | { data?: CustomerDetailBrief }
            | null
          const detail = customerJson?.data
          if (detail && typeof detail === 'object') {
            setCustomerDetail(detail)
          } else {
            setCustomerDetail(null)
          }
        } else {
          setCustomerDetail(null)
        }

        setPayload({
          customer_summary: {
            id: Number(customerId),
            name: customerJson?.data?.name ?? '-',
            phone: customerJson?.data?.phone ?? '-',
            email: customerJson?.data?.email ?? '-',
            customer_type: customerJson?.data?.customer_type ?? '-',
            total_spent: totalSpent,
            total_orders_bookings: totalOrdersBookings,
            last_activity_date: latestActivityMs ? new Date(latestActivityMs).toISOString() : null,
          },
          ecommerce_orders: [],
          pos_orders: [],
          booking_appointments: [],
          service_packages: [],
        })
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load customer history.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchHistory()
    return () => controller.abort()
  }, [customerId, filterKey])

  const summaryCards = useMemo(() => {
    const summary = payload?.customer_summary
    const statusValue = customerDetail?.is_active == null ? null : customerDetail.is_active ? 'active' : 'inactive'
    const tierValue = customerDetail?.tier?.trim() ? customerDetail.tier : null
    const pointsValue =
      customerDetail?.loyalty_summary && typeof customerDetail.loyalty_summary.available_points === 'number'
        ? customerDetail.loyalty_summary.available_points
        : null

    const cards: Array<{ label: string; value: ReactNode }> = [
      {
        label: 'Customer Name',
        value: summary?.name ?? '-',
      },
      { label: 'Tier', value: tierValue ? <span className="capitalize">{tierValue}</span> : '-' },
      {
        label: 'Status',
        value: statusValue ? (
          <StatusBadge status={statusValue} label={statusValue === 'active' ? 'Active' : 'Inactive'} />
        ) : (
          '-'
        ),
      },
      { label: 'Available Points', value: pointsValue != null ? pointsValue.toLocaleString() : '-' },
      { label: 'Phone', value: summary?.phone ?? '-' },
      { label: 'Email', value: summary?.email ?? '-' },
      { label: 'Customer Type', value: summary?.customer_type ?? '-' },
      { label: 'Total Spent', value: formatAmount(summary?.total_spent) },
      { label: 'Total Orders/Bookings', value: String(summary?.total_orders_bookings ?? 0) },
      { label: 'Last Activity Date', value: formatDate(summary?.last_activity_date) },
    ]
    return cards
  }, [customerDetail?.is_active, customerDetail?.loyalty_summary, customerDetail?.tier, payload?.customer_summary])

  const dateFrom = dateFromQuery
  const dateTo = dateToQuery
  const [dateInputs, setDateInputs] = useState({ dateFrom, dateTo })
  useEffect(() => {
    setDateInputs({ dateFrom, dateTo })
  }, [dateFrom, dateTo])

  const applyDateRange = () => {
    const next = new URLSearchParams(searchParams.toString())
    const from = dateInputs.dateFrom.trim()
    const to = dateInputs.dateTo.trim()
    if (from && to) {
      next.set('date_from', from)
      next.set('date_to', to)
    } else {
      next.delete('date_from')
      next.delete('date_to')
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const clearDateRange = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('date_from')
    next.delete('date_to')
    setDateInputs({ dateFrom: '', dateTo: '' })
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading customer history...</div>
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Customer Summary</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-300 bg-slate-50 p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date from</p>
                <input
                  type="date"
                  value={dateInputs.dateFrom}
                  onChange={(e) => setDateInputs((p) => ({ ...p, dateFrom: e.target.value }))}
                  className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date to</p>
                <input
                  type="date"
                  value={dateInputs.dateTo}
                  onChange={(e) => setDateInputs((p) => ({ ...p, dateTo: e.target.value }))}
                  className="mt-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={applyDateRange}
                className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={clearDateRange}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                All time
              </button>
            </div>
          </div>

          {(dateFrom || dateTo) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {dateFrom ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="text-slate-700">Date From</span>
                  <span>{dateFrom}</span>
                  <button
                    type="button"
                    onClick={clearDateRange}
                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-700 hover:bg-blue-100"
                    aria-label="Clear date filter"
                  >
                    ×
                  </button>
                </span>
              ) : null}

              {dateTo ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="text-slate-700">Date To</span>
                  <span>{dateTo}</span>
                  <button
                    type="button"
                    onClick={clearDateRange}
                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-700 hover:bg-blue-100"
                    aria-label="Clear date filter"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </div>
          )}

          <div className="space-y-6">
          {(activeTab === 'all' || activeTab === 'ecommerce') && (
            <section className="rounded-xl border border-slate-300 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/60 px-4 py-3">
                <h4 className="text-base font-semibold text-slate-900">Ecommerce</h4>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {ecommerceTx.length} records
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-200/70 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order No</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Payment</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Net</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ecommerceTx.map((row, index) => (
                      <tr key={`ec-${row.order_id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-100/40'}>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">{row.order_no ?? '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(row.order_datetime)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.payment_method ?? '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.status ?? '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-900">{formatAmount(row.net_amount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDrawer({ type: 'order', orderId: row.order_id })}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {ecommerceTx.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          No ecommerce transactions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'booking') && (
            <section className="rounded-xl border border-slate-300 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/60 px-4 py-3">
                <h4 className="text-base font-semibold text-slate-900">Booking</h4>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {bookingTx.length} records
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-200/70 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order No</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Ref</th>
                      <th className="px-4 py-3 font-semibold">Net</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookingTx.map((row, index) => {
                      const ref = row.type === 'package_purchase' ? row.package_name : row.booking_no
                      const canOpenBooking = Boolean(row.booking_id)
                      return (
                        <tr key={`bk-${row.order_id}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-100/40'}>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">{row.order_no ?? '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDate(row.order_datetime)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.type ?? '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{ref ?? '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-900">{formatAmount(row.net_amount)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (canOpenBooking) {
                                  setDrawer({ type: 'booking', bookingId: Number(row.booking_id) })
                                } else {
                                  setDrawer({ type: 'order', orderId: row.order_id })
                                }
                              }}
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {bookingTx.length === 0 && (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                          No booking transactions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          </div>
        </div>
      </div>

      {drawer?.type === 'order' ? (
        <OrderViewPanel orderId={drawer.orderId} onClose={() => setDrawer(null)} zIndexClassName="z-[70]" />
      ) : null}

      {drawer?.type === 'booking' ? (
        <BookingAppointmentDrawer
          bookingId={drawer.bookingId}
          isOpen
          onClose={() => setDrawer(null)}
          permissions={[]}
        />
      ) : null}

      {drawer?.type === 'package' ? (
        <PackageDetailsDrawer data={drawer.data} onClose={() => setDrawer(null)} />
      ) : null}
    </>
  )
}
