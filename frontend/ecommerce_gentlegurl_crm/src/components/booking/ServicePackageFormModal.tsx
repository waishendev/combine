'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

import type { BookingServiceOption, ServicePackage } from './servicePackageTypes'
import { useI18n } from '@/lib/i18n'

type FormItem = {
  booking_service_id: string
  quantity: string
}

interface ServicePackageFormModalProps {
  mode: 'create' | 'edit'
  packageId?: number
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

interface FormState {
  name: string
  description: string
  selling_price: string
  valid_days: string
  is_active: boolean
  items: FormItem[]
}

const initialForm: FormState = {
  name: '',
  description: '',
  selling_price: '0.00',
  valid_days: '',
  is_active: true,
  items: [{ booking_service_id: '', quantity: '1' }],
}

const getMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== 'object') return fallback
  if ('message' in data && typeof data.message === 'string' && data.message.trim()) {
    return data.message
  }
  if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
    const errors = data.errors as Record<string, unknown>
    const firstKey = Object.keys(errors)[0]
    if (firstKey) {
      const firstValue = errors[firstKey]
      if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') return firstValue[0]
      if (typeof firstValue === 'string') return firstValue
    }
  }
  return fallback
}

export default function ServicePackageFormModal({
  mode,
  packageId,
  onClose,
  onSuccess,
}: ServicePackageFormModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialForm })
  const [services, setServices] = useState<BookingServiceOption[]>([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadingServices, setLoadingServices] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const loadServices = async () => {
      setLoadingServices(true)
      try {
        const res = await fetch('/api/proxy/admin/booking/services?page=1&per_page=200', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setError(getMessage(data, 'Failed to load booking services'))
          return
        }

        const rows =
          data &&
          typeof data === 'object' &&
          'data' in data &&
          data.data &&
          typeof data.data === 'object' &&
          'data' in data.data &&
          Array.isArray(data.data.data)
            ? data.data.data
            : []

        setServices(
          rows
            .filter((item): item is { id: number; name: string; is_package_eligible?: boolean } => (
              typeof item === 'object' &&
              item !== null &&
              typeof item.id === 'number' &&
              typeof item.name === 'string'
            ))
            .filter((item) => item.is_package_eligible !== false)
            .map((item) => ({ id: item.id, name: item.name })),
        )
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load booking services')
        }
      } finally {
        setLoadingServices(false)
      }
    }

    loadServices().catch(() => {
      setLoadingServices(false)
      setError('Failed to load booking services')
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !packageId) {
      return
    }

    const controller = new AbortController()

    const loadPackage = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/service-packages/${packageId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)

        if (data && typeof data === 'object' && data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        if (!res.ok) {
          setError(getMessage(data, 'Failed to load service package'))
          return
        }

        const pkg = data && typeof data === 'object' && 'data' in data ? (data.data as ServicePackage) : null
        if (!pkg) {
          setError('Failed to load service package')
          return
        }

        setForm({
          name: pkg.name ?? '',
          description: pkg.description ?? '',
          selling_price: String(pkg.selling_price ?? '0.00'),
          valid_days: pkg.valid_days ? String(pkg.valid_days) : '',
          is_active: Boolean(pkg.is_active),
          items: Array.isArray(pkg.items) && pkg.items.length > 0
            ? pkg.items.map((item) => ({
                booking_service_id: String(item.booking_service_id),
                quantity: String(item.quantity ?? 1),
              }))
            : [{ booking_service_id: '', quantity: '1' }],
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load service package')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPackage().catch(() => {
      setLoading(false)
      setError('Failed to load service package')
    })

    return () => controller.abort()
  }, [mode, packageId])

  const disableForm = submitting || loading || loadingServices

  const canSubmit = useMemo(() => !disableForm, [disableForm])

  const setItem = (index: number, key: keyof FormItem, value: string) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }))
  }

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { booking_service_id: '', quantity: '1' }],
    }))
  }

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }

    const sellingPrice = Number(form.selling_price)
    const validDays = form.valid_days.trim() === '' ? null : Number(form.valid_days)
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setError('Selling price must be 0 or greater')
      return
    }

    if (validDays !== null && (!Number.isFinite(validDays) || validDays <= 0)) {
      setError('Valid days must be greater than 0')
      return
    }

    if (!Array.isArray(form.items) || form.items.length === 0) {
      setError('At least one package item is required')
      return
    }

    const parsedItems = [] as Array<{ booking_service_id: number; quantity: number }>
    for (const item of form.items) {
      const bookingServiceId = Number(item.booking_service_id)
      const quantity = Number(item.quantity)
      if (!Number.isFinite(bookingServiceId) || bookingServiceId <= 0) {
        setError('Please select a service for each item')
        return
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError('Quantity must be greater than 0')
        return
      }
      parsedItems.push({ booking_service_id: bookingServiceId, quantity })
    }

    setSubmitting(true)
    setError(null)

    try {
      const url = mode === 'edit' && packageId
        ? `/api/proxy/service-packages/${packageId}`
        : '/api/proxy/service-packages'

      const res = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: form.description.trim(),
          is_active: mode === 'create' ? true : form.is_active,
          selling_price: sellingPrice.toFixed(2),
          valid_days: validDays,
          items: parsedItems,
        }),
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object' && data?.success === false && data?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      if (!res.ok) {
        setError(getMessage(data, `Failed to ${mode} service package`))
        return
      }

      await onSuccess()
    } catch (err) {
      console.error(err)
      setError(`Failed to ${mode} service package`)
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
      <div className="relative mx-auto w-full max-w-3xl rounded-lg bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold">
            {mode === 'edit' ? 'Edit Service Package' : 'Create Service Package'}
          </h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {(loading || loadingServices) && (
            <p className="text-sm text-gray-500">{t('common.loadingDetails')}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Package name"
                disabled={disableForm}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={disableForm}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Valid Days
              </label>
              <input
                type="number"
                min={1}
                value={form.valid_days}
                onChange={(e) => setForm((prev) => ({ ...prev, valid_days: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                disabled={disableForm}
                placeholder="Leave empty for no expiry"
              />
            </div>

            {mode === 'edit' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Active Status
                </label>
                <select
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === 'active' }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={disableForm}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={disableForm}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Package Items</h3>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-sm hover:bg-gray-100"
                onClick={addItem}
                disabled={disableForm}
                aria-label="Add item"
                title="Add item"
              >
                <i className="fa-solid fa-plus" />
              </button>
            </div>

            {form.items.map((item, index) => (
              <div key={`${index}-${item.booking_service_id}`} className="grid gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-[1fr_120px_auto]">
                <select
                  value={item.booking_service_id}
                  onChange={(e) => setItem(index, 'booking_service_id', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={disableForm}
                >
                  <option value="">Select service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => setItem(index, 'quantity', e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Qty"
                  disabled={disableForm}
                />

                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-300 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                  onClick={() => removeItem(index)}
                  disabled={disableForm || form.items.length === 1}
                  aria-label="Remove item"
                  title="Remove item"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!canSubmit}
            >
              {submitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
