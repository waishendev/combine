'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { CustomerRowData } from './CustomerRow'
import {
  mapCustomerApiItemToFormState,
  mapCustomerApiItemToRow,
  type CustomerApiItem,
  type CustomerFormState,
} from './customerUtils'
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import { useI18n } from '@/lib/i18n'
import { normalizeInternationalPhone } from '@/lib/phone'

interface CustomerEditModalProps {
  customerId: number
  initialCustomer: CustomerApiItem
  onClose: () => void
  onSuccess: (customer: CustomerRowData) => void
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

export default function CustomerEditModal({
  customerId,
  initialCustomer,
  onClose,
  onSuccess,
}: CustomerEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<CustomerFormState>(() => mapCustomerApiItemToFormState(initialCustomer))
  const [typesLoading, setTypesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedCustomer, setLoadedCustomer] = useState<CustomerRowData | null>(() =>
    mapCustomerApiItemToRow(initialCustomer),
  )
  const [customerTypes, setCustomerTypes] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    const controller = new AbortController()

    const loadCustomerTypes = async () => {
      setTypesLoading(true)
      try {
        const res = await fetch('/api/proxy/customer-types?per_page=200', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        const rows: unknown[] = Array.isArray(data?.data?.data)
          ? data.data.data
          : Array.isArray(data?.data)
            ? data.data
            : []
        const mapped = rows
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') return null
            const rawId = (item as { id?: unknown }).id
            const rawName = (item as { name?: unknown }).name
            const id = typeof rawId === 'number' ? rawId : Number(rawId)
            if (!Number.isFinite(id) || typeof rawName !== 'string') return null
            return { id, name: rawName }
          })
          .filter((item): item is { id: number; name: string } => item !== null)
        setCustomerTypes(mapped)
      } catch {
        if (!controller.signal.aborted) {
          setCustomerTypes([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setTypesLoading(false)
        }
      }
    }

    void loadCustomerTypes()

    return () => controller.abort()
  }, [])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedEmail = form.email.trim()
    const trimmedPhone = normalizeInternationalPhone(form.phone)
    const trimmedPassword = form.password.trim()

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !form.customerTypeId) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        is_active: form.isActive === 'true',
        customer_type_id: Number(form.customerTypeId),
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      }

      const res = await fetch(`/api/proxy/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
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
        setError(t('customer.updateError'))
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: CustomerApiItem | null }).data ?? null)
          : null

      const customerRow: CustomerRowData = payloadData
        ? mapCustomerApiItemToRow(payloadData)
        : {
            id: loadedCustomer?.id ?? customerId,
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            tier: loadedCustomer?.tier ?? '-',
            type:
              customerTypes.find((item) => String(item.id) === form.customerTypeId)?.name ??
              loadedCustomer?.type ??
              '-',
            isActive: form.isActive === 'true',
            createdAt: loadedCustomer?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedCustomer(customerRow)
      onSuccess(customerRow)
    } catch (err) {
      console.error(err)
      setError(t('customer.updateError'))
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = typesLoading || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative mx-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">{t('customer.editTitle')}</h2>
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label
                htmlFor="edit-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t('common.name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={t('common.name')}
                disabled={disableForm}
              />
            </div>

            <div>
              <label
                htmlFor="edit-email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t('common.email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={t('common.emailPlaceholder')}
                disabled
              />
            </div>

            <div>
              <label
                htmlFor="edit-phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Phone <span className="text-red-500">*</span>
              </label>
              <InternationalPhoneInput
                value={form.phone}
                onChange={(phone) => setForm((prev) => ({ ...prev, phone }))}
                placeholder="Enter phone"
                disabled={disableForm}
                required
              />
            </div>

            <div>
              <label
                htmlFor="edit-customerTypeId"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-customerTypeId"
                name="customerTypeId"
                value={form.customerTypeId}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-50"
                disabled={disableForm}
              >
                <option value="">{typesLoading ? 'Loading types...' : 'Select type'}</option>
                {customerTypes.map((type) => (
                  <option key={type.id} value={String(type.id)}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-gender"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Gender
              </label>
              <select
                id="edit-gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={disableForm}
              >
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-date_of_birth"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Date of Birth
              </label>
              <input
                id="edit-date_of_birth"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={disableForm}
              />
            </div>

            <div>
              <label
                htmlFor="edit-password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t('common.passwordKeepBlank')}
              </label>
              <input
                id="edit-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={t('common.newPasswordPlaceholder')}
                disabled={disableForm}
              />
            </div>

            <div>
              <label
                htmlFor="edit-isActive"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t('common.status')} <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-isActive"
                name="isActive"
                value={form.isActive}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={disableForm}
              >
                <option value="true">{t('common.active')}</option>
                <option value="false">{t('common.inactive')}</option>
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-600" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : t('customer.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
