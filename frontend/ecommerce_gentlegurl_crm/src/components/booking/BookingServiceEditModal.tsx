'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'

interface Props {
  serviceId: number
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

type ServiceType = 'premium' | 'standard'

interface FormState {
  name: string
  description: string
  service_type: ServiceType
  duration_min: string
  service_price: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
  imageFile: File | null
  imageUrl: string
}

const initial: FormState = {
  name: '',
  description: '',
  service_type: 'standard',
  duration_min: '30',
  service_price: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
  imageFile: null,
  imageUrl: '',
}

export default function BookingServiceEditModal({ serviceId, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormState>({ ...initial })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`)
        const data = await res.json()
        const s = data?.data as BookingServiceApiItem | undefined
        if (!s) return

        const serviceType: ServiceType = s.service_type === 'premium' ? 'premium' : 'standard'
        setForm((prev) => ({
          ...prev,
          name: String(s.name ?? ''),
          description: String(s.description ?? ''),
          service_type: serviceType,
          duration_min: String(s.duration_min ?? 30),
          service_price: String(s.service_price ?? 0),
          deposit_amount: String(s.deposit_amount ?? 0),
          buffer_min: String(s.buffer_min ?? 15),
          is_active: Boolean(s.is_active === true || s.is_active === 1 || s.is_active === '1' || s.is_active === 'true'),
          imageUrl: String(s.image_url ?? s.image_path ?? ''),
        }))
      } finally {
        setLoading(false)
      }
    }

    run().catch(() => {
      setError('Failed to load booking service')
      setLoading(false)
    })
  }, [serviceId])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const nextValue = e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
      ? e.target.checked
      : value

    setForm((prev) => ({
      ...prev,
      [name]: nextValue,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('_method', 'PUT')
      fd.append('name', form.name)
      fd.append('description', form.description)
      fd.append('service_type', form.service_type)
      fd.append('duration_min', form.duration_min)
      fd.append('service_price', form.service_price)
      fd.append('deposit_amount', form.deposit_amount)
      fd.append('buffer_min', form.buffer_min)
      fd.append('is_active', form.is_active ? '1' : '0')
      if (form.imageFile) {
        fd.append('image', form.imageFile)
      }

      const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data as { message?: string } | null)?.message ?? 'Failed to update booking service')
        return
      }

      onSuccess(mapBookingServiceApiItemToRow((data?.data ?? {}) as BookingServiceApiItem))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-lg p-5">
        <h2 className="font-semibold mb-3">Edit Booking Service</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="name" value={form.name} onChange={handleChange} className="w-full border p-2 rounded" />
          <select name="service_type" value={form.service_type} onChange={handleChange} className="w-full border p-2 rounded">
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <textarea name="description" value={form.description} onChange={handleChange} className="w-full border p-2 rounded" />
          {form.imageUrl && <img src={form.imageUrl} className="h-16 w-16 object-cover rounded" alt="Current" />}
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, imageFile: e.target.files?.[0] ?? null }))} />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={submitting} className="bg-blue-600 text-white px-3 py-2 rounded">Save</button>
        </form>
      </div>
    </div>
  )
}
