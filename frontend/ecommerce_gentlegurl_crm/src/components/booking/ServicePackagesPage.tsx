'use client'

import { useCallback, useEffect, useState } from 'react'

type ServicePackageItem = {
  id: number
  booking_service_id: number
  quantity: number
  booking_service?: {
    id: number
    name: string
  }
}

type ServicePackage = {
  id: number
  name: string
  description?: string | null
  selling_price: number
  total_sessions: number
  valid_days?: number | null
  is_active: boolean
  items?: ServicePackageItem[]
}

type BookingServiceOption = {
  id: number
  name: string
}

type FormState = {
  id?: number
  name: string
  description: string
  selling_price: string
  total_sessions: string
  valid_days: string
  is_active: boolean
  items: Array<{ booking_service_id: string; quantity: string }>
}

const emptyForm: FormState = {
  name: '',
  description: '',
  selling_price: '',
  total_sessions: '',
  valid_days: '',
  is_active: true,
  items: [{ booking_service_id: '', quantity: '1' }],
}

export default function ServicePackagesPage() {
  const [rows, setRows] = useState<ServicePackage[]>([])
  const [services, setServices] = useState<BookingServiceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pkgRes, svcRes] = await Promise.all([
        fetch('/api/proxy/service-packages', { cache: 'no-store' }),
        fetch('/api/proxy/booking/services', { cache: 'no-store' }),
      ])

      const pkgJson = await pkgRes.json().catch(() => ({}))
      const svcJson = await svcRes.json().catch(() => ({}))

      const packageData = Array.isArray(pkgJson?.data) ? pkgJson.data : []
      const serviceData = Array.isArray(svcJson?.data) ? svcJson.data : []

      setRows(packageData)
      setServices(
        serviceData
          .map((item: unknown): BookingServiceOption | null => {
            if (!item || typeof item !== 'object') return null
            const maybe = item as Record<string, unknown>
            const id = Number(maybe.id)
            const name = String(maybe.name ?? '').trim()
            if (!Number.isFinite(id) || id <= 0 || !name) return null
            return { id, name }
          })
          .filter((item): item is BookingServiceOption => Boolean(item))
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const submit = async () => {
    setSaving(true)
    setMessage(null)

    const payload = {
      name: form.name,
      description: form.description || null,
      selling_price: Number(form.selling_price || 0),
      total_sessions: Number(form.total_sessions || 0),
      valid_days: form.valid_days ? Number(form.valid_days) : null,
      is_active: form.is_active,
      items: form.items
        .map((item) => ({
          booking_service_id: Number(item.booking_service_id || 0),
          quantity: Number(item.quantity || 0),
        }))
        .filter((item) => item.booking_service_id > 0 && item.quantity > 0),
    }

    const isEdit = Boolean(form.id)
    const target = isEdit ? `/api/proxy/service-packages/${form.id}` : '/api/proxy/service-packages'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(target, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(json?.message ?? 'Unable to save service package.')
        return
      }
      setMessage(isEdit ? 'Service package updated.' : 'Service package created.')
      setForm(emptyForm)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const onEdit = (pkg: ServicePackage) => {
    setForm({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? '',
      selling_price: String(pkg.selling_price ?? ''),
      total_sessions: String(pkg.total_sessions ?? ''),
      valid_days: pkg.valid_days == null ? '' : String(pkg.valid_days),
      is_active: Boolean(pkg.is_active),
      items: (pkg.items && pkg.items.length > 0
        ? pkg.items.map((item) => ({
            booking_service_id: String(item.booking_service_id),
            quantity: String(item.quantity),
          }))
        : [{ booking_service_id: '', quantity: '1' }]),
    })
  }

  const onDelete = async (id: number) => {
    if (!window.confirm('Delete this service package?')) return
    const res = await fetch(`/api/proxy/service-packages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessage('Service package deleted.')
      await loadData()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Service Package CRUD</h3>
        <p className="mt-1 text-sm text-gray-600">Create / edit package and package items (services + qty).</p>
        {message ? <p className="mt-2 text-sm text-blue-700">{message}</p> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Package name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="Selling price" value={form.selling_price} onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="Total sessions" value={form.total_sessions} onChange={(e) => setForm((prev) => ({ ...prev, total_sessions: e.target.value }))} />
          <input className="rounded border px-3 py-2" placeholder="Valid days (optional)" value={form.valid_days} onChange={(e) => setForm((prev) => ({ ...prev, valid_days: e.target.value }))} />
          <input className="rounded border px-3 py-2 md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">Package Items</p>
          {form.items.map((item, idx) => (
            <div key={`item-${idx}`} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
              <select
                className="rounded border px-3 py-2"
                value={item.booking_service_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    items: prev.items.map((r, i) => (i === idx ? { ...r, booking_service_id: e.target.value } : r)),
                  }))
                }
              >
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
              <input
                className="rounded border px-3 py-2"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    items: prev.items.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)),
                  }))
                }
              />
              <button
                className="rounded border border-red-300 px-3 py-2 text-red-700"
                onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) || [] }))}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, { booking_service_id: '', quantity: '1' }] }))}
          >
            + Add Item
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
          Active
        </label>

        <div className="mt-4 flex gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving...' : form.id ? 'Update Package' : 'Create Package'}
          </button>
          <button className="rounded border px-4 py-2" onClick={() => setForm(emptyForm)} type="button">Reset</button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Service Package Listing</h3>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No package created yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {rows.map((pkg) => (
              <div key={pkg.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-xs text-gray-600">RM {Number(pkg.selling_price).toFixed(2)} • Sessions {pkg.total_sessions} • Valid {pkg.valid_days ?? '-'} days</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded border px-3 py-1 text-sm" onClick={() => onEdit(pkg)} type="button">Edit</button>
                    <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => void onDelete(pkg.id)} type="button">Delete</button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {(pkg.items ?? []).length > 0 ? (pkg.items ?? []).map((item) => `${item.booking_service?.name ?? `Service#${item.booking_service_id}`} x${item.quantity}`).join(' • ') : 'No items'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
