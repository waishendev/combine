'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: number
  appointment_id: number
  booking_number: string
  customer_name: string | null
  action: string
  action_label: string
  actor_user_id: number | null
  actor_name: string | null
  created_at: string | null
}

type FilterOption = { key?: string; id?: number; label?: string; name?: string }

const formatDateTime = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}

export default function AppointmentActivityLogTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [actions, setActions] = useState<FilterOption[]>([])
  const [users, setUsers] = useState<FilterOption[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
  const [filters, setFilters] = useState({ search: '', booking_number: '', action: '', actor_user_id: '', date_from: '', date_to: '' })

  const query = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), per_page: String(pagination.per_page) })
    Object.entries(filters).forEach(([key, value]) => { if (value) qs.set(key, value) })
    return qs.toString()
  }, [filters, page, pagination.per_page])

  useEffect(() => {
    let active = true
    fetch(`/api/proxy/admin/appointment-activity-logs?${query}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load appointment activity logs.')
        return res.json()
      })
      .then((json) => {
        if (!active) return
        const data = json?.data ?? json
        setRows(Array.isArray(data?.rows) ? data.rows : [])
        setPagination(data?.pagination ?? { current_page: 1, last_page: 1, total: 0, per_page: 25 })
        setActions(Array.isArray(data?.filters?.actions) ? data.filters.actions : [])
        setUsers(Array.isArray(data?.filters?.users) ? data.filters.users : [])
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-6">
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Search" value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Booking ID" value={filters.booking_number} onChange={(e) => updateFilter('booking_number', e.target.value)} />
        <select className="rounded-lg border px-3 py-2 text-sm" value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
          <option value="">All actions</option>
          {actions.map((action) => <option key={action.key} value={action.key}>{action.label}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={filters.actor_user_id} onChange={(e) => updateFilter('actor_user_id', e.target.value)}>
          <option value="">All users</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={filters.date_from} onChange={(e) => updateFilter('date_from', e.target.value)} />
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={filters.date_to} onChange={(e) => updateFilter('date_to', e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Date & Time</th><th className="px-4 py-3">Booking ID</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Performed By</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Loading...</td></tr> : rows.length === 0 ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No appointment activity logs found.</td></tr> : rows.map((row) => (
              <tr key={row.id}><td className="px-4 py-3 text-slate-700">{formatDateTime(row.created_at)}</td><td className="px-4 py-3 font-medium text-slate-900">{row.booking_number}</td><td className="px-4 py-3 text-slate-700">{row.customer_name || 'Walk-in Customer'}</td><td className="px-4 py-3"><span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700">{row.action_label}</span></td><td className="px-4 py-3 text-slate-700">{row.actor_name || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600"><span>Total: {pagination.total}</span><div className="flex items-center gap-2"><button className="rounded-lg border px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button><span>Page {pagination.current_page} of {pagination.last_page}</span><button className="rounded-lg border px-3 py-1 disabled:opacity-50" disabled={page >= pagination.last_page} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>
    </div>
  )
}
