'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

type BlockScope = 'STORE' | 'STAFF'

type StaffOption = {
  id: number
  name: string
}

type BlockRow = {
  id: number
  scope: BlockScope
  staff_id: number | null
  start_at: string
  end_at: string
  reason: string | null
}

type Props = {
  permissions: string[]
}

type FormValues = {
  scope: BlockScope
  staff_id: string
  start_at: string
  end_at: string
  reason: string
}

const defaultForm: FormValues = {
  scope: 'STORE',
  staff_id: '',
  start_at: '',
  end_at: '',
  reason: '',
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  if (root.data && typeof root.data === 'object' && 'data' in (root.data as object)) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T[]
  }
  return []
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function BookingBlocksPage({ permissions }: Props) {
  const [rows, setRows] = useState<BlockRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [scopeFilter, setScopeFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BlockRow | null>(null)
  const [form, setForm] = useState<FormValues>(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const canCreate = permissions.includes('booking.blocks.create')
  const canUpdate = permissions.includes('booking.blocks.update')
  const canDelete = permissions.includes('booking.blocks.delete')

  const staffMap = useMemo(() => {
    const map = new Map<number, string>()
    staffs.forEach((staff) => map.set(staff.id, staff.name))
    return map
  }, [staffs])

  const loadStaffs = async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      if (!res.ok) {
        setStaffs([])
        return
      }
      const payload = await res.json().catch(() => ({}))
      setStaffs(extractArray<StaffOption>(payload))
    } catch {
      setStaffs([])
    }
  }

  const loadBlocks = async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (scopeFilter) qs.set('scope', scopeFilter)
      if (staffFilter) qs.set('staff_id', staffFilter)
      if (fromFilter) qs.set('from', new Date(fromFilter).toISOString())
      if (toFilter) qs.set('to', new Date(toFilter).toISOString())

      const res = await fetch(`/api/proxy/admin/booking/blocks?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        setError('Failed to load blocks.')
        return
      }

      const payload = await res.json().catch(() => ({}))
      setRows(extractArray<BlockRow>(payload))
    } catch {
      setRows([])
      setError('Failed to load blocks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStaffs()
  }, [])

  useEffect(() => {
    void loadBlocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFilter, staffFilter, fromFilter, toFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...defaultForm, scope: (scopeFilter === 'STORE' || scopeFilter === 'STAFF' ? scopeFilter : 'STORE') })
    setModalOpen(true)
  }

  const openEdit = (row: BlockRow) => {
    setEditing(row)
    setForm({
      scope: row.scope,
      staff_id: row.staff_id ? String(row.staff_id) : '',
      start_at: row.start_at ? new Date(row.start_at).toISOString().slice(0, 16) : '',
      end_at: row.end_at ? new Date(row.end_at).toISOString().slice(0, 16) : '',
      reason: row.reason || '',
    })
    setModalOpen(true)
  }

  const validateForm = (): string | null => {
    if (!form.start_at || !form.end_at) return 'Start and end datetime are required.'
    const start = new Date(form.start_at)
    const end = new Date(form.end_at)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Start and end datetime are invalid.'
    }
    if (start >= end) return 'End datetime must be after start datetime.'
    if (form.scope === 'STAFF' && !form.staff_id) return 'Staff is required for STAFF scope blocks.'
    return null
  }

  const submitForm = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        scope: form.scope,
        staff_id: form.scope === 'STAFF' ? Number(form.staff_id) : null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        reason: form.reason.trim() || null,
      }

      const url = editing
        ? `/api/proxy/admin/booking/blocks/${editing.id}`
        : '/api/proxy/admin/booking/blocks'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const response = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(response.message || 'Failed to save block.')
        return
      }

      setModalOpen(false)
      setEditing(null)
      setForm(defaultForm)
      await loadBlocks()
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (row: BlockRow) => {
    if (!canDelete) return
    if (!window.confirm(`Delete this ${row.scope} block?`)) return

    const res = await fetch(`/api/proxy/admin/booking/blocks/${row.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const response = await res.json().catch(() => ({})) as { message?: string }
      setError(response.message || 'Failed to delete block.')
      return
    }

    await loadBlocks()
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Booking Blocks</h2>
          <p className="mt-1 text-sm text-slate-500">Manage store and staff blocked time ranges.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Add Block
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="">All Scopes</option>
            <option value="STORE">STORE</option>
            <option value="STAFF">STAFF</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} disabled={scopeFilter === 'STORE'}>
            <option value="">All Staff</option>
            {staffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
          </select>
          <input type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} />
          <input type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={toFilter} onChange={(e) => setToFilter(e.target.value)} />
          <button type="button" onClick={() => void loadBlocks()} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Refresh</button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <TableLoadingRow colSpan={6} />}
            {!loading && rows.length === 0 && <TableEmptyState colSpan={6} />}
            {!loading && rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.scope}</td>
                <td className="px-4 py-3">{row.staff_id ? (staffMap.get(row.staff_id) || `#${row.staff_id}`) : '-'}</td>
                <td className="px-4 py-3">{formatDateTime(row.start_at)}</td>
                <td className="px-4 py-3">{formatDateTime(row.end_at)}</td>
                <td className="px-4 py-3">{row.reason || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canUpdate && <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => openEdit(row)}>Edit</button>}
                    {canDelete && <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={() => void remove(row)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">{editing ? 'Edit Block' : 'Create Block'}</h3>
            <div className="mt-4 grid gap-3">
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.scope} onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as BlockScope }))}>
                <option value="STORE">STORE</option>
                <option value="STAFF">STAFF</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.staff_id} onChange={(e) => setForm((prev) => ({ ...prev, staff_id: e.target.value }))} disabled={form.scope !== 'STAFF'}>
                <option value="">Select staff</option>
                {staffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
              </select>
              <div className="grid gap-3 md:grid-cols-2">
                <input type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.start_at} onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))} />
                <input type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.end_at} onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))} />
              </div>
              <textarea className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason (optional)" rows={3} value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={() => void submitForm()} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
