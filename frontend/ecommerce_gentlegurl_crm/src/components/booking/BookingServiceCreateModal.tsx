'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'

interface BookingServiceCreateModalProps {
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

interface FormState {
  name: string
  description: string
  duration_min: string
  service_price: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
}

const initialFormState: FormState = {
  name: '',
  description: '',
  duration_min: '30',
  service_price: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
}

export default function BookingServiceCreateModal({
  onClose,
  onSuccess,
}: BookingServiceCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = event.target
    if (type === 'checkbox') {
      const checked = (event.target as HTMLInputElement).checked
      setForm((prev) => ({ ...prev, [name]: checked }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()

    if (!trimmedName) {
      setError('Name is required')
      return
    }

    const duration = Number(form.duration_min)
    const servicePrice = Number(form.service_price)
    const deposit = Number(form.deposit_amount)
    const buffer = Number(form.buffer_min)

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be greater than 0')
      return
    }
    if (!Number.isFinite(servicePrice) || servicePrice < 0) {
      setError('Service price must be 0 or greater')
      return
    }
    if (!Number.isFinite(deposit) || deposit < 0) {
      setError('Deposit must be 0 or greater')
      return
    }
    if (!Number.isFinite(buffer) || buffer < 0) {
      setError('Buffer must be 0 or greater')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/admin/booking/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          description: form.description.trim() || null,
          duration_min: duration,
          service_price: servicePrice,
          deposit_amount: deposit,
          buffer_min: buffer,
          is_active: form.is_active,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create booking service'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
        }
        setError(message)
        return
      }

      const payload =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: BookingServiceApiItem | null }).data ?? null)
          : null

      const serviceRow: BookingServiceRowData = payload
        ? mapBookingServiceApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            description: form.description.trim(),
            duration_min: duration,
            service_price: servicePrice,
            deposit_amount: deposit,
            buffer_min: buffer,
            isActive: form.is_active,
          }

      setForm({ ...initialFormState })
      onSuccess(serviceRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create booking service')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Booking Service</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Service name"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Service description"
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="duration_min"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Duration (min) <span className="text-red-500">*</span>
              </label>
              <input
                id="duration_min"
                name="duration_min"
                type="number"
                min={1}
                value={form.duration_min}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="30"
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="deposit_amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Deposit Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="deposit_amount"
                name="deposit_amount"
                type="number"
                min={0}
                step="0.01"
                value={form.deposit_amount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="buffer_min"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Buffer (min) <span className="text-red-500">*</span>
              </label>
              <input
                id="buffer_min"
                name="buffer_min"
                type="number"
                min={0}
                value={form.buffer_min}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="15"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                disabled={submitting}
              />
              Active
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
