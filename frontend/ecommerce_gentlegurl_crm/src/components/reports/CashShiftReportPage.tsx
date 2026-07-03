'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReportDetailDrawer, ReportViewDetailsButton } from '@/components/reports/ReportActions'
import { formatDateTime12Hour } from '@/lib/formatDateTime'

type CashShiftRow = {
  id: number
  event_type: 'OPEN' | 'CLOSE'
  linked_open_shift_id?: number | null
  event_at?: string | null
  opening_amount: number
  opening_refill_packet?: number | null
  opening_atm?: number | null
  opened_by_name?: string | null
  opened_staff_name?: string | null
  opened_at?: string | null
  closing_amount?: number | null
  closing_withdraw?: number | null
  closing_refill_cash?: number | null
  closed_by_name?: string | null
  closed_staff_name?: string | null
  closed_at?: string | null
  status: 'OPEN' | 'CLOSE'
  remark?: string | null
  total_initial_cash: number
  total_withdraw: number
  cash_sales: number
  expected_cash: number
  difference?: number | null
}

type PoolBalances = {
  total_initial_cash: number
  total_withdraw: number
}

const currency = (value: number | null | undefined) => `RM ${Number(value ?? 0).toFixed(2)}`
const formatDateTime = (value?: string | null) => formatDateTime12Hour(value) || '—'
const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : '—')
const displayAmount = (value?: number | null) => (value == null || value === 0 ? '—' : currency(value))

function defaultDateRange() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  return { from: local, to: local }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function SummaryStatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'blue' | 'violet'
}) {
  const accentClass = accent === 'blue'
    ? 'border-blue-200 bg-blue-50 text-blue-900'
    : 'border-violet-200 bg-violet-50 text-violet-900'

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accentClass}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">Current Pool</p>
      <p className="mt-1 text-sm font-semibold opacity-90">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  )
}

function eventBadgeClass(eventType: CashShiftRow['event_type']) {
  return eventType === 'OPEN'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-rose-100 text-rose-700'
}

function DateTimeCell({ value }: { value?: string | null }) {
  if (!value) return <span>—</span>
  return (
    <div className="leading-tight">
      <p className="font-medium text-gray-900">{formatDate(value)}</p>
      <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(value)}</p>
    </div>
  )
}

const tableHeadings = [
  'Event',
  'Date',
  'Staff',
  'Opening',
  'Closing',
  'Expected',
  'Difference',
  'Refill Packet',
  'ATM',
  'Withdraw',
  'Refill Cash',
  'Total Pool Initial',
  'Total Pool Withdraw',
  'Details',
]

export default function CashShiftReportPage() {
  const defaults = useMemo(() => defaultDateRange(), [])
  const [filters, setFilters] = useState({ date_from: defaults.from, date_to: defaults.to, status: '', staff_id: '', user_id: '' })
  const [rows, setRows] = useState<CashShiftRow[]>([])
  const [poolBalances, setPoolBalances] = useState<PoolBalances | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedRow, setSelectedRow] = useState<CashShiftRow | null>(null)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await fetch('/api/proxy/ecommerce/reports/cash-shifts/summary', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load cash shift summary.')
      const payload = json?.data ?? {}
      setPoolBalances({
        total_initial_cash: Number(payload.pool_balances?.total_initial_cash ?? 0),
        total_withdraw: Number(payload.pool_balances?.total_withdraw ?? 0),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cash shift summary.')
      setPoolBalances(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const loadData = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: String(targetPage), per_page: '20' })
      if (filters.date_from) qs.set('date_from', filters.date_from)
      if (filters.date_to) qs.set('date_to', filters.date_to)
      if (filters.status) qs.set('status', filters.status)
      if (filters.staff_id) qs.set('staff_id', filters.staff_id)
      if (filters.user_id) qs.set('user_id', filters.user_id)

      const [reportRes] = await Promise.all([
        fetch(`/api/proxy/ecommerce/reports/cash-shifts?${qs.toString()}`, { cache: 'no-store' }),
        loadSummary(),
      ])
      const json = await reportRes.json().catch(() => null)
      if (!reportRes.ok) throw new Error(json?.message ?? 'Unable to load cash shift report.')

      const payload = json?.data ?? {}
      setRows(Array.isArray(payload.data) ? payload.data : [])
      setPage(Number(payload.current_page ?? targetPage))
      setLastPage(Number(payload.last_page ?? 1))
      setTotal(Number(payload.total ?? 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cash shift report.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filters, loadSummary])

  useEffect(() => {
    void loadData(1)
  }, [loadData])

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryStatCard
          label="Total Initial Cash"
          value={summaryLoading ? '…' : currency(poolBalances?.total_initial_cash)}
          accent="blue"
        />
        <SummaryStatCard
          label="Total Withdraw"
          value={summaryLoading ? '…' : currency(poolBalances?.total_withdraw)}
          accent="violet"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="text-sm font-semibold text-gray-700">
            Date From
            <input type="date" value={filters.date_from} onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Date To
            <input type="date" value={filters.date_to} onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Event
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3">
              <option value="">All</option>
              <option value="OPEN">OPEN</option>
              <option value="CLOSE">CLOSE</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Staff ID
            <input type="number" min="1" value={filters.staff_id} onChange={(e) => setFilters((p) => ({ ...p, staff_id: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" placeholder="Optional staff ID" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Account/User ID
            <input type="number" min="1" value={filters.user_id} onChange={(e) => setFilters((p) => ({ ...p, user_id: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3" placeholder="Optional user ID" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={() => void loadData(1)} disabled={loading} className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Loading…' : 'Apply Filters'}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                {tableHeadings.map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const isOpen = row.event_type === 'OPEN'
                const eventDate = isOpen ? row.opened_at : row.closed_at
                const staffName = isOpen ? row.opened_staff_name : row.closed_staff_name

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${eventBadgeClass(row.event_type)}`}>{row.event_type}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <DateTimeCell value={eventDate} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{staffName ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.opening_amount ? currency(row.opening_amount) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{!isOpen && row.closing_amount != null ? currency(row.closing_amount) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{!isOpen ? currency(row.expected_cash) : '—'}</td>
                    <td className={`whitespace-nowrap px-4 py-3 font-semibold ${Number(row.difference ?? 0) < 0 ? 'text-red-600' : Number(row.difference ?? 0) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                      {!isOpen && row.difference != null ? currency(row.difference) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{isOpen ? displayAmount(row.opening_refill_packet) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{isOpen ? displayAmount(row.opening_atm) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{!isOpen ? displayAmount(row.closing_withdraw) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{!isOpen ? displayAmount(row.closing_refill_cash) : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-700">{currency(row.total_initial_cash)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-violet-700">{currency(row.total_withdraw)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <ReportViewDetailsButton
                        onClick={() => setSelectedRow(row)}
                        title={`View ${row.event_type} record #${row.id}`}
                      />
                    </td>
                  </tr>
                )
              })}
              {!loading && rows.length === 0 ? (
                <tr><td colSpan={tableHeadings.length} className="px-4 py-10 text-center text-gray-500">No cash shift records found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
          <span>Total: {total}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadData(Math.max(1, page - 1))} disabled={loading || page <= 1} className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50">Previous</button>
            <span>Page {page} / {lastPage}</span>
            <button type="button" onClick={() => void loadData(Math.min(lastPage, page + 1))} disabled={loading || page >= lastPage} className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <ReportDetailDrawer
        open={Boolean(selectedRow)}
        title={selectedRow ? `${selectedRow.event_type} #${selectedRow.id}` : 'Cash Shift'}
        subtitle={selectedRow ? formatDateTime(selectedRow.event_at ?? selectedRow.opened_at ?? selectedRow.closed_at) : undefined}
        onClose={() => setSelectedRow(null)}
        maxWidthClassName="max-w-3xl"
      >
        {selectedRow ? (
          <div className="space-y-6">
            <section>
              <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Pool Snapshot</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Total Initial Cash" value={currency(selectedRow.total_initial_cash)} />
                <DetailField label="Total Withdraw" value={currency(selectedRow.total_withdraw)} />
              </div>
            </section>

            {selectedRow.event_type === 'OPEN' ? (
              <section>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Open Details</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Opened Staff" value={selectedRow.opened_staff_name ?? '—'} />
                  <DetailField label="Opened By Account" value={selectedRow.opened_by_name ?? '—'} />
                  <DetailField label="Opening Amount" value={currency(selectedRow.opening_amount)} />
                  <DetailField label="Refill Cash (Packet)" value={displayAmount(selectedRow.opening_refill_packet)} />
                  <DetailField label="ATM" value={displayAmount(selectedRow.opening_atm)} />
                  <DetailField label="Opened At" value={formatDateTime(selectedRow.opened_at)} />
                </div>
              </section>
            ) : (
              <section>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">Close Details</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Closed At" value={formatDateTime(selectedRow.closed_at)} />
                  <DetailField label="Closed Staff" value={selectedRow.closed_staff_name ?? '—'} />
                  <DetailField label="Opening Amount (session)" value={currency(selectedRow.opening_amount)} />
                  <DetailField label="Closing Amount" value={selectedRow.closing_amount == null ? '—' : currency(selectedRow.closing_amount)} />
                  <DetailField label="Cash Sales" value={currency(selectedRow.cash_sales)} />
                  <DetailField label="Expected Cash" value={currency(selectedRow.expected_cash)} />
                  <DetailField label="Difference" value={selectedRow.difference == null ? '—' : currency(selectedRow.difference)} />
                  <DetailField label="Withdraw" value={displayAmount(selectedRow.closing_withdraw)} />
                  <DetailField label="Refill Cash" value={displayAmount(selectedRow.closing_refill_cash)} />
                  <DetailField label="Remarks" value={selectedRow.remark || '—'} />
                  <DetailField label="Closed By Account" value={selectedRow.closed_by_name ?? '—'} />
                </div>
              </section>
            )}
          </div>
        ) : null}
      </ReportDetailDrawer>
    </div>
  )
}
