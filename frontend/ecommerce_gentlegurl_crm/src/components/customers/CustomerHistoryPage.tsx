'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import BookingAppointmentDrawer from '@/components/booking/BookingAppointmentDrawer'
import OrderViewPanel from '@/components/OrderViewPanel'
import PaginationControls from '@/components/PaginationControls'
import StatusBadge from '@/components/StatusBadge'
import WalletTransactionDetailDrawer from '@/components/wallet/WalletTransactionDetailDrawer'

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

type WalletTx = {
  id: number
  transaction_no?: string | null
  type?: string | null
  direction?: string | null
  amount?: string | number | null
  balance_before?: string | number | null
  balance_after?: string | number | null
  workspace_type?: string | null
  payment_method_label?: string | null
  reference_no?: string | null
  status?: string | null
  remark?: string | null
  created_at?: string | null
  completed_at?: string | null
  creator?: { name?: string | null } | null
}

type WalletSummary = {
  wallet_balance?: string | number | null
  total_deposited?: string | number | null
  total_withdrawn?: string | number | null
  pending_topups?: WalletTx[]
  recent_transactions?: WalletTx[]
}

type TabKey = 'all' | 'ecommerce' | 'booking' | 'balance'

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
  gender?: string | null
  date_of_birth?: string | null
  tier?: string | null
  is_active?: boolean | null
  loyalty_summary?: {
    available_points: number
  } | null
}

type PageMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
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

type SalesReportJson = {
  rows?: EcommerceRow[] | BookingRow[]
  grand_totals?: { net_amount?: number; orders_count?: number }
  pagination?: Partial<PageMeta>
}

const HISTORY_PAGE_SIZES = [20, 50, 100] as const
const DEFAULT_PER_PAGE = 20

const EMPTY_META: PageMeta = {
  current_page: 1,
  last_page: 1,
  per_page: DEFAULT_PER_PAGE,
  total: 0,
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
}

function formatGenderLabel(gender?: string | null) {
  if (!gender) return '-'
  return GENDER_LABELS[gender.toLowerCase()] ?? gender
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ecommerce', label: 'Ecommerce' },
  { key: 'booking', label: 'Booking' },
  { key: 'balance', label: 'Balance' },
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

function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parsePageMeta(partial: Partial<PageMeta> | undefined, fallbackPage: number, fallbackPerPage: number): PageMeta {
  return {
    current_page: Number(partial?.current_page ?? fallbackPage) || fallbackPage,
    last_page: Math.max(1, Number(partial?.last_page ?? 1) || 1),
    per_page: Number(partial?.per_page ?? fallbackPerPage) || fallbackPerPage,
    total: Math.max(0, Number(partial?.total ?? 0) || 0),
  }
}

function recordCountLabel(onPage: number, total: number) {
  return `${onPage} on page · ${total} total`
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

  const dateFromQuery = searchParams.get('date_from') ?? ''
  const dateToQuery = searchParams.get('date_to') ?? ''
  const pageQuery = Number(searchParams.get('page'))
  const perPageRaw = Number(searchParams.get('per_page'))
  const currentPage = Number.isFinite(pageQuery) && pageQuery > 0 ? pageQuery : 1
  const perPage = (HISTORY_PAGE_SIZES as readonly number[]).includes(perPageRaw)
    ? perPageRaw
    : DEFAULT_PER_PAGE

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [profileLoading, setProfileLoading] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailBrief | null>(null)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [ecommerceTx, setEcommerceTx] = useState<EcommerceRow[]>([])
  const [ecommerceMeta, setEcommerceMeta] = useState<PageMeta>(EMPTY_META)
  const [ecommerceGrandNet, setEcommerceGrandNet] = useState(0)
  const [bookingTx, setBookingTx] = useState<BookingRow[]>([])
  const [bookingMeta, setBookingMeta] = useState<PageMeta>(EMPTY_META)
  const [bookingGrandNet, setBookingGrandNet] = useState(0)
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null)
  const [walletTx, setWalletTx] = useState<WalletTx[]>([])
  const [walletMeta, setWalletMeta] = useState<PageMeta>(EMPTY_META)
  const [walletDetailTx, setWalletDetailTx] = useState<WalletTx | null>(null)
  const [dateInputs, setDateInputs] = useState({ dateFrom: dateFromQuery, dateTo: dateToQuery })

  const resolvedDateRange = useMemo(() => {
    const hasRange = Boolean(dateFromQuery.trim() && dateToQuery.trim())
    if (hasRange) {
      return { from: dateFromQuery.trim(), to: dateToQuery.trim() }
    }
    const to = formatYmd(new Date())
    const from = formatYmd(new Date(new Date().setFullYear(new Date().getFullYear() - 1)))
    return { from, to }
  }, [dateFromQuery, dateToQuery])

  useEffect(() => {
    setDateInputs({ dateFrom: dateFromQuery, dateTo: dateToQuery })
  }, [dateFromQuery, dateToQuery])

  const replaceQuery = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString())
    mutate(next)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const setPageInUrl = (page: number) => {
    replaceQuery((next) => {
      if (page <= 1) next.delete('page')
      else next.set('page', String(page))
    })
  }

  const resetPageInUrl = (mutate?: (next: URLSearchParams) => void) => {
    replaceQuery((next) => {
      mutate?.(next)
      next.delete('page')
    })
  }

  // Effect 1: customer profile + wallet summary (once per customer)
  useEffect(() => {
    const controller = new AbortController()

    const fetchProfile = async () => {
      setProfileLoading(true)
      setProfileError(null)
      try {
        const [customerResponse, walletResponse] = await Promise.all([
          fetch(`/api/proxy/customers/${customerId}`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: { Accept: 'application/json', 'Accept-Language': 'en' },
          }),
          fetch(`/api/proxy/admin/customers/${customerId}/wallet`, {
            cache: 'no-store',
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          }),
        ])

        if (!customerResponse.ok) {
          throw new Error('Failed to load customer profile.')
        }

        const customerJson = (await customerResponse.json().catch(() => null)) as
          | { data?: CustomerDetailBrief }
          | null
        const detail = customerJson?.data
        setCustomerDetail(detail && typeof detail === 'object' ? detail : null)

        if (walletResponse.ok) {
          const walletJson = (await walletResponse.json().catch(() => null)) as { data?: WalletSummary } | null
          setWalletSummary(walletJson?.data ?? null)
        } else {
          setWalletSummary(null)
        }
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setProfileError(fetchError instanceof Error ? fetchError.message : 'Failed to load customer profile.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setProfileLoading(false)
        }
      }
    }

    void fetchProfile()
    return () => controller.abort()
  }, [customerId])

  // Effect 2: tab / date / page report fetches
  useEffect(() => {
    const controller = new AbortController()

    const fetchReports = async () => {
      setReportsLoading(true)
      setReportsError(null)
      try {
        const qs = new URLSearchParams()
        qs.set('date_from', resolvedDateRange.from)
        qs.set('date_to', resolvedDateRange.to)
        qs.set('per_page', String(perPage))
        qs.set('page', String(currentPage))
        qs.set('customer_id', customerId)

        const needEcommerce = activeTab === 'all' || activeTab === 'ecommerce'
        const needBooking = activeTab === 'all' || activeTab === 'booking'
        const needWallet = activeTab === 'all' || activeTab === 'balance'

        const requests: Array<Promise<Response | null>> = [
          needEcommerce
            ? fetch(`/api/proxy/ecommerce/reports/sales/ecommerce?${qs.toString()}`, {
                cache: 'no-store',
                signal: controller.signal,
              })
            : Promise.resolve(null),
          needBooking
            ? fetch(`/api/proxy/ecommerce/reports/sales/booking?${qs.toString()}`, {
                cache: 'no-store',
                signal: controller.signal,
              })
            : Promise.resolve(null),
          needWallet
            ? fetch(
                `/api/proxy/admin/customers/${customerId}/wallet/transactions?page=${currentPage}&per_page=${perPage}`,
                {
                  cache: 'no-store',
                  signal: controller.signal,
                  headers: { Accept: 'application/json' },
                },
              )
            : Promise.resolve(null),
        ]

        const [ecommerceResponse, bookingResponse, walletTxResponse] = await Promise.all(requests)

        if (needEcommerce) {
          if (!ecommerceResponse?.ok) {
            throw new Error('Failed to load ecommerce history.')
          }
          const ecommerceJson = (await ecommerceResponse.json().catch(() => null)) as SalesReportJson | null
          const ecRows = Array.isArray(ecommerceJson?.rows) ? (ecommerceJson!.rows as EcommerceRow[]) : []
          setEcommerceTx(ecRows)
          setEcommerceMeta(parsePageMeta(ecommerceJson?.pagination, currentPage, perPage))
          setEcommerceGrandNet(Number(ecommerceJson?.grand_totals?.net_amount ?? 0) || 0)
        }

        if (needBooking) {
          if (!bookingResponse?.ok) {
            throw new Error('Failed to load booking history.')
          }
          const bookingJson = (await bookingResponse.json().catch(() => null)) as SalesReportJson | null
          const bkRows = Array.isArray(bookingJson?.rows) ? (bookingJson!.rows as BookingRow[]) : []
          setBookingTx(bkRows)
          setBookingMeta(parsePageMeta(bookingJson?.pagination, currentPage, perPage))
          setBookingGrandNet(Number(bookingJson?.grand_totals?.net_amount ?? 0) || 0)
        }

        if (needWallet) {
          if (walletTxResponse?.ok) {
            const walletTxJson = (await walletTxResponse.json().catch(() => null)) as {
              data?: {
                transactions?:
                  | WalletTx[]
                  | {
                      data?: WalletTx[]
                      current_page?: number
                      last_page?: number
                      per_page?: number
                      total?: number
                    }
              }
            } | null
            const txPayload = walletTxJson?.data?.transactions
            if (Array.isArray(txPayload)) {
              setWalletTx(txPayload)
              setWalletMeta({
                current_page: currentPage,
                last_page: 1,
                per_page: perPage,
                total: txPayload.length,
              })
            } else {
              setWalletTx(Array.isArray(txPayload?.data) ? txPayload.data : [])
              setWalletMeta(
                parsePageMeta(
                  {
                    current_page: txPayload?.current_page,
                    last_page: txPayload?.last_page,
                    per_page: txPayload?.per_page,
                    total: txPayload?.total,
                  },
                  currentPage,
                  perPage,
                ),
              )
            }
          } else if (walletTxResponse) {
            setWalletTx([])
            setWalletMeta({ ...EMPTY_META, per_page: perPage, current_page: currentPage })
          }
        }
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setReportsError(fetchError instanceof Error ? fetchError.message : 'Failed to load customer history.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setReportsLoading(false)
        }
      }
    }

    void fetchReports()
    return () => controller.abort()
  }, [customerId, resolvedDateRange.from, resolvedDateRange.to, currentPage, perPage, activeTab])

  const lastActivityDate = useMemo(() => {
    const parseTime = (value?: string | null) => {
      if (!value) return 0
      const t = new Date(value).getTime()
      return Number.isNaN(t) ? 0 : t
    }
    const latest = Math.max(
      0,
      ...ecommerceTx.map((r) => parseTime(r.order_datetime)),
      ...bookingTx.map((r) => parseTime(r.order_datetime)),
    )
    return latest ? new Date(latest).toISOString() : null
  }, [ecommerceTx, bookingTx])

  const totalSpent = ecommerceGrandNet + bookingGrandNet
  const totalOrdersBookings = ecommerceMeta.total + bookingMeta.total

  const summaryCards = useMemo(() => {
    const statusValue = customerDetail?.is_active == null ? null : customerDetail.is_active ? 'active' : 'inactive'
    const tierValue = customerDetail?.tier?.trim() ? customerDetail.tier : null
    const pointsValue =
      customerDetail?.loyalty_summary && typeof customerDetail.loyalty_summary.available_points === 'number'
        ? customerDetail.loyalty_summary.available_points
        : null

    const cards: Array<{ label: string; value: ReactNode }> = [
      { label: 'Customer Name', value: customerDetail?.name ?? '-' },
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
      { label: 'Gender', value: formatGenderLabel(customerDetail?.gender) },
      { label: 'Date of Birth', value: formatDateOnly(customerDetail?.date_of_birth) },
      { label: 'Phone', value: customerDetail?.phone ?? '-' },
      { label: 'Email', value: customerDetail?.email ?? '-' },
      { label: 'Customer Type', value: customerDetail?.customer_type ?? '-' },
      { label: 'Total Spent', value: formatAmount(totalSpent) },
      { label: 'Total Orders/Bookings', value: String(totalOrdersBookings) },
      { label: 'Last Activity Date', value: formatDate(lastActivityDate) },
      { label: 'Current Balance', value: formatAmount(Number(walletSummary?.wallet_balance ?? 0)) },
      { label: 'Total Wallet Credits', value: formatAmount(Number(walletSummary?.total_deposited ?? 0)) },
      { label: 'Total Wallet Debits', value: formatAmount(Number(walletSummary?.total_withdrawn ?? 0)) },
      {
        label: 'Pending Top Up Amount',
        value: formatAmount(
          (walletSummary?.pending_topups ?? []).reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0),
        ),
      },
    ]
    return cards
  }, [
    customerDetail,
    lastActivityDate,
    totalOrdersBookings,
    totalSpent,
    walletSummary,
  ])

  const activeMeta = useMemo(() => {
    if (activeTab === 'ecommerce') return ecommerceMeta
    if (activeTab === 'booking') return bookingMeta
    if (activeTab === 'balance') return walletMeta
    return {
      current_page: currentPage,
      per_page: perPage,
      last_page: Math.max(ecommerceMeta.last_page, bookingMeta.last_page, walletMeta.last_page, 1),
      total: Math.max(ecommerceMeta.total, bookingMeta.total, walletMeta.total),
    }
  }, [activeTab, bookingMeta, currentPage, ecommerceMeta, perPage, walletMeta])

  const applyDateRange = () => {
    const from = dateInputs.dateFrom.trim()
    const to = dateInputs.dateTo.trim()
    resetPageInUrl((next) => {
      if (from && to) {
        next.set('date_from', from)
        next.set('date_to', to)
      } else {
        next.delete('date_from')
        next.delete('date_to')
      }
    })
  }

  const clearDateRange = () => {
    setDateInputs({ dateFrom: '', dateTo: '' })
    resetPageInUrl((next) => {
      next.delete('date_from')
      next.delete('date_to')
    })
  }

  const applyAllTimeRange = () => {
    const from = '2000-01-01'
    const to = formatYmd(new Date())
    setDateInputs({ dateFrom: from, dateTo: to })
    resetPageInUrl((next) => {
      next.set('date_from', from)
      next.set('date_to', to)
    })
  }

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key)
    if (currentPage !== 1) {
      setPageInUrl(1)
    }
  }

  const handlePageSizeChange = (size: number) => {
    resetPageInUrl((next) => {
      if (size === DEFAULT_PER_PAGE) next.delete('per_page')
      else next.set('per_page', String(size))
    })
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (activeMeta.last_page || 1)) return
    setPageInUrl(page)
  }

  if (profileLoading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading customer history...</div>
  }

  if (profileError) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{profileError}</div>
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
                  onClick={() => handleTabChange(tab.key)}
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
              <div className="flex items-center gap-2 pb-0.5">
                <label htmlFor="historyPageSize" className="text-sm text-slate-700">
                  Show
                </label>
                <select
                  id="historyPageSize"
                  value={perPage}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:opacity-50"
                  disabled={reportsLoading}
                >
                  {HISTORY_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
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
                onClick={applyAllTimeRange}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                All time
              </button>
            </div>
          </div>

          {(dateFromQuery || dateToQuery) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {dateFromQuery ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="text-slate-700">Date From</span>
                  <span>{dateFromQuery}</span>
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

              {dateToQuery ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  <span className="text-slate-700">Date To</span>
                  <span>{dateToQuery}</span>
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

          {reportsError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{reportsError}</div>
          ) : null}

          <div className="space-y-6">
            {(activeTab === 'all' || activeTab === 'ecommerce') && (
              <section className="rounded-xl border border-slate-300 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/60 px-4 py-3">
                  <h4 className="text-base font-semibold text-slate-900">Ecommerce</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {recordCountLabel(ecommerceTx.length, ecommerceMeta.total)}
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
                      {reportsLoading ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                            Loading ecommerce transactions...
                          </td>
                        </tr>
                      ) : (
                        <>
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
                        </>
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
                    {recordCountLabel(bookingTx.length, bookingMeta.total)}
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
                      {reportsLoading ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                            Loading booking transactions...
                          </td>
                        </tr>
                      ) : (
                        <>
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
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(activeTab === 'all' || activeTab === 'balance') && (
              <section className="rounded-xl border border-slate-300 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/60 px-4 py-3">
                  <h4 className="text-base font-semibold text-slate-900">Customer Balance History</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {recordCountLabel(walletTx.length, walletMeta.total)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-200/70 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Transaction No</th>
                        <th className="px-4 py-3">Date/time</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Workspace</th>
                        <th className="px-4 py-3">Payment Method</th>
                        <th className="px-4 py-3">Credit</th>
                        <th className="px-4 py-3">Debit</th>
                        <th className="px-4 py-3">Before</th>
                        <th className="px-4 py-3">After</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Processed By</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportsLoading ? (
                        <tr>
                          <td className="px-4 py-8 text-center text-slate-500" colSpan={14}>
                            Loading balance transactions...
                          </td>
                        </tr>
                      ) : (
                        <>
                          {walletTx.map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-4 py-3 font-medium">{tx.transaction_no ?? '-'}</td>
                              <td className="px-4 py-3">{formatDate(tx.created_at)}</td>
                              <td className="px-4 py-3">
                                {tx.type === 'topup'
                                  ? 'Customer Top Up'
                                  : tx.type === 'admin_credit'
                                    ? 'CRM Deposit'
                                    : tx.type === 'admin_debit'
                                      ? 'CRM Withdrawal'
                                      : tx.type ?? '-'}
                              </td>
                              <td className="px-4 py-3">{tx.workspace_type ?? '-'}</td>
                              <td className="px-4 py-3">{tx.payment_method_label ?? '-'}</td>
                              <td className="px-4 py-3 text-emerald-700">
                                {tx.direction === 'credit' ? `+${formatAmount(Number(tx.amount ?? 0))}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-rose-700">
                                {tx.direction === 'debit' ? `-${formatAmount(Number(tx.amount ?? 0))}` : '-'}
                              </td>
                              <td className="px-4 py-3">{formatAmount(Number(tx.balance_before ?? 0))}</td>
                              <td className="px-4 py-3">{formatAmount(Number(tx.balance_after ?? 0))}</td>
                              <td className="px-4 py-3">
                                {tx.status === 'pending' ? 'Pending Verification' : tx.status ?? '-'}
                              </td>
                              <td className="px-4 py-3">{tx.creator?.name ?? '-'}</td>
                              <td className="px-4 py-3">{tx.remark ?? '-'}</td>
                              <td className="px-4 py-3">{tx.reference_no ?? '-'}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => setWalletDetailTx(tx)}
                                  className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {tx.status === 'completed' ? 'Receipt' : 'Details'}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {walletTx.length === 0 ? (
                            <tr>
                              <td className="px-4 py-8 text-center text-slate-500" colSpan={14}>
                                No balance transactions.
                              </td>
                            </tr>
                          ) : null}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          <PaginationControls
            currentPage={activeMeta.current_page}
            totalPages={activeMeta.last_page}
            pageSize={activeMeta.per_page}
            onPageChange={handlePageChange}
            disabled={reportsLoading}
          />
        </div>
      </div>

      {walletDetailTx ? (
        <WalletTransactionDetailDrawer
          customerId={customerId}
          transactionId={walletDetailTx.id}
          fallback={walletDetailTx}
          onClose={() => setWalletDetailTx(null)}
        />
      ) : null}

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
