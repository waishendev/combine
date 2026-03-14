'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'

interface BookingServiceEditModalProps {
  serviceId: number
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

interface FormState {
  name: string
  description: string
  duration_min: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
}

const initialFormState: FormState = {
  name: '',
  description: '',
  duration_min: '30',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
}

export default function BookingServiceEditModal({
  serviceId,
  onClose,
  onSuccess,
}: BookingServiceEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedService, setLoadedService] = useState<BookingServiceRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadService = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        })

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError('Failed to load booking service')
          return
        }

        const service = data?.data as BookingServiceApiItem | undefined
        if (!service || typeof service !== 'object') {
          setError('Failed to load booking service')
          return
        }

        const mappedService = mapBookingServiceApiItemToRow(service)
        setLoadedService(mappedService)

        setForm({
          name: typeof service.name === 'string' ? service.name : '',
          description: typeof service.description === 'string' ? service.description : '',
          duration_min: String(service.duration_min ?? 30),
          deposit_amount: String(service.deposit_amount ?? 0),
          buffer_min: String(service.buffer_min ?? 15),
          is_active:
            service.is_active === true || service.is_active === 'true' || service.is_active === 1,
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load booking service')
        }
      } finally {
        setLoading(false)
      }
    }

    loadService().catch(() => {
      setLoading(false)
      setError('Failed to load booking service')
    })

    return () => controller.abort()
  }, [serviceId])

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
    const deposit = Number(form.deposit_amount)
    const buffer = Number(form.buffer_min)

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be greater than 0')
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
      const payload: Record<string, unknown> = {
        name: trimmedName,
        description: form.description.trim() || null,
        duration_min: duration,
        deposit_amount: deposit,
        buffer_min: buffer,
        is_active: form.is_active,
      }

      const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object') {
          if ('message' in data && typeof data.message === 'string') {
            setError(data.message)
            return
          }
          if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            if (firstKey) {
              const firstValue = errors[firstKey]
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                setError(firstValue[0])
                return
              }
              if (typeof firstValue === 'string') {
                setError(firstValue)
                return
              }
            }
          }
        }
        setError('Failed to update booking service')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: BookingServiceApiItem | null }).data ?? null)
          : null

      const serviceRow: BookingServiceRowData = payloadData
        ? mapBookingServiceApiItemToRow(payloadData)
        : {
            id: loadedService?.id ?? serviceId,
            name: trimmedName,
            description: form.description.trim(),
            duration_min: duration,
            deposit_amount: deposit,
            buffer_min: buffer,
            isActive: form.is_active,
            createdAt: loadedService?.createdAt,
          }

      setLoadedService(serviceRow)
      onSuccess(serviceRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update booking service')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

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
          <h2 className="text-lg font-semibold">Edit Booking Service</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Service name"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Service description"
                  rows={3}
                  disabled={disableForm}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="edit-duration_min"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Duration (min) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-duration_min"
                    name="duration_min"
                    type="number"
                    min={1}
                    value={form.duration_min}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="30"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-deposit_amount"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Deposit Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-deposit_amount"
                    name="deposit_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.deposit_amount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-buffer_min"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Buffer (min) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-buffer_min"
                    name="buffer_min"
                    type="number"
                    min={0}
                    value={form.buffer_min}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="15"
                    disabled={disableForm}
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
                    disabled={disableForm}
                  />
                  Active
                </label>
              </div>
            </>
          )}

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
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
