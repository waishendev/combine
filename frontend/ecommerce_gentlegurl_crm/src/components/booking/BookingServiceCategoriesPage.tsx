'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type ServiceOption = { id: number; name: string }
type Category = {
  id: number
  name: string
  slug: string
  description?: string | null
  image_url?: string | null
  is_active: boolean
  sort_order: number
  service_ids: number[]
}

const emptyForm = { name: '', slug: '', description: '', is_active: true, service_ids: [] as number[] }

export default function BookingServiceCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const load = async () => {
    const [categoryRes, serviceRes] = await Promise.all([
      fetch('/api/proxy/admin/booking/categories?per_page=200', { cache: 'no-store' }),
      fetch('/api/proxy/admin/booking/services?per_page=200', { cache: 'no-store' }),
    ])

    const categoryJson = await categoryRes.json().catch(() => ({}))
    const serviceJson = await serviceRes.json().catch(() => ({}))

    const categoryItems = Array.isArray(categoryJson?.data?.data) ? categoryJson.data.data : []
    const serviceItems = Array.isArray(serviceJson?.data?.data) ? serviceJson.data.data : []

    setRows(categoryItems)
    setServices(serviceItems.map((item: { id: number; name: string }) => ({ id: Number(item.id), name: item.name })))
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('name', form.name)
    if (form.slug) fd.append('slug', form.slug)
    fd.append('description', form.description)
    fd.append('is_active', form.is_active ? '1' : '0')
    if (imageFile) fd.append('image', imageFile)
    form.service_ids.forEach((id) => fd.append('service_ids[]', String(id)))

    const url = editingId ? `/api/proxy/admin/booking/categories/${editingId}` : '/api/proxy/admin/booking/categories'
    if (editingId) fd.append('_method', 'PUT')

    await fetch(url, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
    setForm(emptyForm)
    setImageFile(null)
    setEditingId(null)
    await load()
  }

  const startEdit = (row: Category) => {
    setEditingId(row.id)
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      is_active: row.is_active,
      service_ids: row.service_ids ?? [],
    })
  }

  const selectedLabel = useMemo(
    () => services.filter((svc) => form.service_ids.includes(svc.id)).map((svc) => svc.name).join(', '),
    [services, form.service_ids],
  )

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-lg border p-4 space-y-3 bg-white">
        <h3 className="font-semibold">{editingId ? 'Edit Category' : 'Create Category'}</h3>
        <input className="w-full border rounded px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        <input className="w-full border rounded px-3 py-2" placeholder="Slug (optional)" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
        <textarea className="w-full border rounded px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} /> Active</label>
        <div className="rounded border p-2">
          <p className="text-sm font-medium">Services</p>
          <p className="text-xs text-gray-500 mb-2">{selectedLabel || 'No services selected'}</p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
            {services.map((svc) => (
              <label key={svc.id} className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.service_ids.includes(svc.id)}
                  onChange={() => setForm((p) => ({ ...p, service_ids: p.service_ids.includes(svc.id) ? p.service_ids.filter((id) => id !== svc.id) : [...p.service_ids, svc.id] }))}
                />
                {svc.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white" type="submit">{editingId ? 'Update' : 'Create'}</button>
          {editingId ? <button className="px-4 py-2 rounded border" type="button" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancel</button> : null}
        </div>
      </form>

      <table className="w-full border-collapse bg-white">
        <thead>
          <tr>
            <th className="border px-3 py-2 text-left">Name</th>
            <th className="border px-3 py-2 text-left">Sort</th>
            <th className="border px-3 py-2 text-left">Status</th>
            <th className="border px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border px-3 py-2">{row.name}</td>
              <td className="border px-3 py-2">{row.sort_order}</td>
              <td className="border px-3 py-2">{row.is_active ? 'Active' : 'Inactive'}</td>
              <td className="border px-3 py-2 space-x-2">
                <button className="px-2 py-1 border rounded" onClick={() => startEdit(row)}>Edit</button>
                <button className="px-2 py-1 border rounded" onClick={async () => { await fetch(`/api/proxy/admin/booking/categories/${row.id}/move-up`, { method: 'POST' }); await load() }}>↑</button>
                <button className="px-2 py-1 border rounded" onClick={async () => { await fetch(`/api/proxy/admin/booking/categories/${row.id}/move-down`, { method: 'POST' }); await load() }}>↓</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
