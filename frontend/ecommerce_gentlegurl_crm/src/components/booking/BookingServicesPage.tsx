'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'

type ServiceRow = {
  id: number
  name: string
  description?: string | null
  duration_min: number
  deposit_amount: string | number
  buffer_min: number
  is_active: boolean
  created_at?: string
}

type Props = {
  permissions: string[]
}

type FormValues = {
  name: string
  description: string
  duration_min: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
}

const emptyForm: FormValues = {
  name: '',
  description: '',
  duration_min: '30',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
}

const extractRows = (payload: unknown): ServiceRow[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as ServiceRow[]
  if (root.data && typeof root.data === 'object' && 'data' in (root.data as object)) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as ServiceRow[]
  }
  return []
}

export default function BookingServicesPage({ permissions }: Props) {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const canCreate = permissions.includes('booking.services.create')
  const canUpdate = permissions.includes('booking.services.update')
  const canDelete = permissions.includes('booking.services.delete')

  const loadServices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/services', { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        setError('Failed to load booking services.')
        return
      }

      const payload = await res.json().catch(() => ({}))
      setRows(extractRows(payload))
    } catch {
      setRows([])
      setError('Failed to load booking services.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadServices()
  }, [])

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const term = query.trim().toLowerCase()
    return rows.filter((row) => row.name.toLowerCase().includes(term) || (row.description ?? '').toLowerCase().includes(term))
  }, [rows, query])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (row: ServiceRow) => {
    setEditing(row)
    setForm({
      name: row.name,
      description: row.description ?? '',
      duration_min: String(row.duration_min),
      deposit_amount: String(row.deposit_amount ?? 0),
      buffer_min: String(row.buffer_min ?? 0),
      is_active: Boolean(row.is_active),
    })
    setModalOpen(true)
  }

  const validate = () => {
    const duration = Number(form.duration_min)
    const deposit = Number(form.deposit_amount)
    const buffer = Number(form.buffer_min)

    if (!form.name.trim()) return 'Name is required.'
    if (!Number.isFinite(duration) || duration <= 0) return 'Duration must be greater than 0.'
    if (!Number.isFinite(deposit) || deposit < 0) return 'Deposit must be 0 or greater.'
    if (!Number.isFinite(buffer) || buffer < 0) return 'Buffer must be 0 or greater.'

    return null
  }

  const submitForm = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_min: Number(form.duration_min),
      deposit_amount: Number(form.deposit_amount),
      buffer_min: Number(form.buffer_min),
      is_active: form.is_active,
    }

    try {
      const url = editing
        ? `/api/proxy/admin/booking/services/${editing.id}`
        : '/api/proxy/admin/booking/services'

      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const response = await res.json().catch(() => ({})) as { message?: string }
      if (!res.ok) {
        setError(response.message || 'Failed to save booking service.')
        return
      }

      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadServices()
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (row: ServiceRow) => {
    if (!canUpdate) return
    setError(null)

    const res = await fetch(`/api/proxy/admin/booking/services/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    })

    if (!res.ok) {
      const response = await res.json().catch(() => ({})) as { message?: string }
      setError(response.message || 'Failed to toggle service status.')
      return
    }

    await loadServices()
  }

  const remove = async (row: ServiceRow) => {
    if (!canDelete) return
    if (!window.confirm(`Delete service "${row.name}"?`)) return

    const res = await fetch(`/api/proxy/admin/booking/services/${row.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const response = await res.json().catch(() => ({})) as { message?: string }
      setError(response.message || 'Failed to delete service.')
      return
    }

    await loadServices()
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Booking Services</h2>
          <p className="mt-1 text-sm text-slate-500">Manage service durations, deposits, buffer time, and status.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Create Service
          </button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search by name or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" onClick={loadServices} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Duration (min)</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Buffer (min)</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <TableLoadingRow colSpan={6} />}
            {!loading && filteredRows.length === 0 && <TableEmptyState colSpan={6} />}
            {!loading && filteredRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.description || '-'}</div>
                </td>
                <td className="px-4 py-3">{row.duration_min}</td>
                <td className="px-4 py-3">{row.deposit_amount}</td>
                <td className="px-4 py-3">{row.buffer_min}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!canUpdate}
                    onClick={() => void toggleActive(row)}
                    className={`rounded px-2 py-1 text-xs font-medium ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'} ${!canUpdate ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    {row.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {canUpdate && (
                      <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={() => void remove(row)}>
                        Delete
                      </button>
                    )}
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
            <h3 className="text-lg font-semibold">{editing ? 'Edit Service' : 'Create Service'}</h3>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <textarea
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Description (optional)"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Duration"
                  value={form.duration_min}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_min: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Deposit"
                  value={form.deposit_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, deposit_amount: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Buffer"
                  value={form.buffer_min}
                  onChange={(e) => setForm((prev) => ({ ...prev, buffer_min: e.target.value }))}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-2 text-sm" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={() => void submitForm()} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
