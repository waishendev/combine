'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

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
    ecommerce_orders?: Array<{
      id: number
      order_number?: string | null
      date?: string | null
      status?: string | null
      total_amount?: number | null
    }>
    pos_orders?: Array<{
      id: number
      receipt_number?: string | null
      date?: string | null
      payment_method?: string | null
      status?: string | null
      total_amount?: number | null
    }>
    booking_appointments?: Array<{
      id: number
      booking_no?: string | null
      date_time?: string | null
      service_names?: string[]
      staff?: string | null
      status?: string | null
      amount?: number | null
    }>
    service_packages?: Array<{
      id: number
      package_name?: string | null
      purchase_date?: string | null
      remaining_sessions?: number | null
      status?: string | null
    }>
  }
}

type TabKey = 'overview' | 'ecommerce' | 'pos' | 'booking' | 'packages'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'ecommerce', label: 'Ecommerce Orders' },
  { key: 'pos', label: 'POS Purchases' },
  { key: 'booking', label: 'Booking Appointments' },
  { key: 'packages', label: 'Packages' },
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

export default function CustomerHistoryPage({ customerId }: { customerId: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<HistoryResponse['data']>()

  useEffect(() => {
    const controller = new AbortController()

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/proxy/customers/${customerId}/history`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load customer history.')
        }

        const json: HistoryResponse = await response.json()
        setPayload(json.data)
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
  }, [customerId])

  const summaryCards = useMemo(() => {
    const summary = payload?.customer_summary
    return [
      { label: 'Customer Name', value: summary?.name ?? '-' },
      { label: 'Phone', value: summary?.phone ?? '-' },
      { label: 'Email', value: summary?.email ?? '-' },
      { label: 'Customer Type', value: summary?.customer_type ?? '-' },
      { label: 'Total Spent', value: formatAmount(summary?.total_spent) },
      { label: 'Total Orders/Bookings', value: String(summary?.total_orders_bookings ?? 0) },
      { label: 'Last Activity Date', value: formatDate(summary?.last_activity_date) },
    ]
  }, [payload?.customer_summary])

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading customer history...</div>
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
  }

  const ecommerceOrders = payload?.ecommerce_orders ?? []
  const posOrders = payload?.pos_orders ?? []
  const bookings = payload?.booking_appointments ?? []
  const packages = payload?.service_packages ?? []

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Customer Summary</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <div key={item.label} className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === 'overview' || activeTab === 'ecommerce') && (
          <section className="mb-6">
            <h4 className="mb-2 text-base font-semibold">Ecommerce Orders</h4>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2">Order No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {ecommerceOrders.map((order) => (
                  <tr key={`e-${order.id}`} className="border-t">
                    <td className="px-3 py-2">{order.order_number ?? '-'}</td>
                    <td className="px-3 py-2">{formatDate(order.date)}</td>
                    <td className="px-3 py-2">{order.status ?? '-'}</td>
                    <td className="px-3 py-2">{formatAmount(order.total_amount)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/orders?search=${encodeURIComponent(order.order_number ?? '')}`} className="text-blue-600 hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
                {ecommerceOrders.length === 0 && (
                  <tr><td className="px-3 py-3 text-gray-500" colSpan={5}>No ecommerce order history.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'pos') && (
          <section className="mb-6">
            <h4 className="mb-2 text-base font-semibold">POS Purchases</h4>
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="px-3 py-2">Receipt No</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Payment Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>
                {posOrders.map((order) => (
                  <tr key={`p-${order.id}`} className="border-t"><td className="px-3 py-2">{order.receipt_number ?? '-'}</td><td className="px-3 py-2">{formatDate(order.date)}</td><td className="px-3 py-2">{order.payment_method ?? '-'}</td><td className="px-3 py-2">{order.status ?? '-'}</td><td className="px-3 py-2">{formatAmount(order.total_amount)}</td><td className="px-3 py-2"><Link href={`/pos`} className="text-blue-600 hover:underline">View</Link></td></tr>
                ))}
                {posOrders.length === 0 && (
                  <tr><td className="px-3 py-3 text-gray-500" colSpan={6}>No POS purchase history.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'booking') && (
          <section className="mb-6">
            <h4 className="mb-2 text-base font-semibold">Booking Appointments</h4>
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="px-3 py-2">Booking No</th><th className="px-3 py-2">Date/Time</th><th className="px-3 py-2">Services</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Action</th></tr></thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={`b-${booking.id}`} className="border-t"><td className="px-3 py-2">{booking.booking_no ?? '-'}</td><td className="px-3 py-2">{formatDate(booking.date_time)}</td><td className="px-3 py-2">{booking.service_names?.join(', ') || '-'}</td><td className="px-3 py-2">{booking.staff ?? '-'}</td><td className="px-3 py-2">{booking.status ?? '-'}</td><td className="px-3 py-2">{formatAmount(booking.amount)}</td><td className="px-3 py-2"><Link href="/booking/appointments" className="text-blue-600 hover:underline">View</Link></td></tr>
                ))}
                {bookings.length === 0 && (
                  <tr><td className="px-3 py-3 text-gray-500" colSpan={7}>No booking history.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'packages') && (
          <section>
            <h4 className="mb-2 text-base font-semibold">Service Packages</h4>
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50 text-left"><th className="px-3 py-2">Package Name</th><th className="px-3 py-2">Purchase Date</th><th className="px-3 py-2">Remaining Sessions</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={`s-${pkg.id}`} className="border-t"><td className="px-3 py-2">{pkg.package_name ?? '-'}</td><td className="px-3 py-2">{formatDate(pkg.purchase_date)}</td><td className="px-3 py-2">{pkg.remaining_sessions ?? '-'}</td><td className="px-3 py-2">{pkg.status ?? '-'}</td></tr>
                ))}
                {packages.length === 0 && (
                  <tr><td className="px-3 py-3 text-gray-500" colSpan={4}>No service package history.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}
