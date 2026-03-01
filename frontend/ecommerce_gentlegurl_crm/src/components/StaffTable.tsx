'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import { mapStaffApiItemToRow, StaffApiItem, StaffRowData } from './staffUtils'

type StaffTableProps = {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type StaffForm = {
  code: string
  name: string
  phone: string
  email: string
  commissionPercent: string
  isActive: 'true' | 'false'
}

const initialForm: StaffForm = {
  code: '',
  name: '',
  phone: '',
  email: '',
  commissionPercent: '0',
  isActive: 'true',
}

export default function StaffTable({ permissions }: StaffTableProps) {
  const canCreate = permissions.includes('staff.create')
  const canUpdate = permissions.includes('staff.update')
  const canDelete = permissions.includes('staff.delete')

  const [rows, setRows] = useState<StaffRowData[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 15, total: 0 })
  const [loading, setLoading] = useState(true)

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRowData | null>(null)
  const [form, setForm] = useState<StaffForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const appliedStatus = useMemo(() => status, [status])

  const loadData = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (search.trim()) qs.set('search', search.trim())
      if (appliedStatus !== 'all') qs.set('is_active', appliedStatus === 'active' ? '1' : '0')

      const res = await fetch(`/api/proxy/staffs?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller?.signal,
      })

      if (!res.ok) {
        setRows([])
        return
      }

      const json = await res.json().catch(() => ({}))
      const payload = json?.data?.data ?? []
      const list = Array.isArray(payload) ? payload.map((item: StaffApiItem) => mapStaffApiItemToRow(item)) : []
      setRows(list)

      setMeta({
        current_page: Number(json?.data?.current_page ?? 1),
        last_page: Number(json?.data?.last_page ?? 1),
        per_page: Number(json?.data?.per_page ?? pageSize),
        total: Number(json?.data?.total ?? list.length),
      })
    } finally {
      setLoading(false)
    }
  }, [appliedStatus, currentPage, pageSize, search])

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller).catch(() => setRows([]))
    return () => controller.abort()
  }, [loadData])

  const openCreate = () => {
    setEditing(null)
    setForm(initialForm)
    setError(null)
    setIsModalOpen(true)
  }

  const openEdit = (row: StaffRowData) => {
    setEditing(row)
    setForm({
      code: row.code === '-' ? '' : row.code,
      name: row.name === '-' ? '' : row.name,
      phone: row.phone === '-' ? '' : row.phone,
      email: '',
      commissionPercent: String((row.commissionRate * 100).toFixed(2)).replace(/\.00$/, ''),
      isActive: row.isActive ? 'true' : 'false',
    })
    setError(null)
    setIsModalOpen(true)
  }

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Name is required and minimum 2 characters.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const commissionRate = Number(form.commissionPercent || 0) / 100
      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        commission_rate: Number.isFinite(commissionRate) ? commissionRate : 0,
        is_active: form.isActive === 'true',
      }

      const url = editing ? `/api/proxy/staffs/${editing.id}` : '/api/proxy/staffs'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? 'Failed to save staff.')
        return
      }

      setIsModalOpen(false)
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (row: StaffRowData) => {
    if (!canDelete) return
    if (!window.confirm(`Deactivate ${row.name}?`)) return

    await fetch(`/api/proxy/staffs/${row.id}`, { method: 'DELETE' })
    await loadData()
  }

  return (
    <div className="rounded-lg bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex gap-2">
          {canCreate && (
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" onClick={openCreate}>Create Staff</button>
          )}
          <button className="rounded-md border px-4 py-2 text-sm" onClick={() => setIsFilterOpen((v) => !v)}>Filter</button>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/code" className="rounded-md border px-3 py-2 text-sm" />
        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => { setCurrentPage(1); loadData().catch(() => {}) }}>Apply</button>
      </div>

      {isFilterOpen && (
        <div className="p-4 border-b flex gap-3">
          <select className="rounded border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value as 'all' | 'active' | 'inactive'); setCurrentPage(1) }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Commission Rate (%)</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Created At</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <TableLoadingRow colSpan={7} /> : rows.length === 0 ? <TableEmptyState colSpan={7} message="No staffs found." /> : rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2">{row.name}</td><td className="px-4 py-2">{row.code}</td><td className="px-4 py-2">{row.phone}</td>
                <td className="px-4 py-2">{(row.commissionRate * 100).toFixed(2)}%</td>
                <td className="px-4 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-2">{row.createdAt || '-'}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    {canUpdate && <button className="text-blue-600" onClick={() => openEdit(row)}>Edit</button>}
                    {canDelete && <button className="text-red-600" onClick={() => handleDelete(row)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Total: {meta.total}</div>
          <select className="rounded border px-2 py-1 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}>
            {[15, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
        </div>
        <PaginationControls currentPage={meta.current_page} totalPages={meta.last_page} pageSize={meta.per_page} onPageChange={setCurrentPage} />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-lg bg-white p-5">
            <h3 className="mb-4 text-lg font-semibold">{editing ? 'Edit Staff' : 'Create Staff'}</h3>
            <form className="space-y-3" onSubmit={submitForm}>
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Code (optional)" value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} />
              <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
              <input type="number" min="0" max="100" step="0.01" className="w-full rounded border px-3 py-2 text-sm" placeholder="Commission Rate (%)" value={form.commissionPercent} onChange={(e) => setForm((v) => ({ ...v, commissionPercent: e.target.value }))} />
              <select className="w-full rounded border px-3 py-2 text-sm" value={form.isActive} onChange={(e) => setForm((v) => ({ ...v, isActive: e.target.value as 'true' | 'false' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-sm text-white" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
