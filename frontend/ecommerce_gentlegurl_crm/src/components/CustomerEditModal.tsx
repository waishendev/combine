'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { CustomerRowData } from './CustomerRow'
import { mapCustomerApiItemToRow, type CustomerApiItem } from './customerUtils'
import { useI18n } from '@/lib/i18n'

interface CustomerEditModalProps {
  customerId: number
  onClose: () => void
  onSuccess: (customer: CustomerRowData) => void
}

interface FormState {
  name: string
  email: string
  phone: string
  isActive: 'true' | 'false'
}

const initialFormState: FormState = {
  name: '',
  email: '',
  phone: '',
  isActive: 'true',
}

export default function CustomerEditModal({
  customerId,
  onClose,
  onSuccess,
}: CustomerEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedCustomer, setLoadedCustomer] = useState<CustomerRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadCustomer = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/customers/${customerId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
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
          setError(t('customer.loadError'))
          return
        }

        const customer = data?.data as CustomerApiItem | undefined
        if (!customer || typeof customer !== 'object') {
          setError(t('customer.loadError'))
          return
        }

        const mappedCustomer = mapCustomerApiItemToRow(customer)
        setLoadedCustomer(mappedCustomer)

        setForm({
          name: typeof customer.name === 'string' ? customer.name : '',
          email: typeof customer.email === 'string' ? customer.email : '',
          phone: typeof customer.phone === 'string' ? customer.phone : '',
          isActive:
            customer.is_active === true || customer.is_active === 'true' || customer.is_active === 1
              ? 'true'
              : 'false',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('customer.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadCustomer().catch(() => {
      setLoading(false)
      setError(t('customer.loadError'))
    })

    return () => controller.abort()
  }, [customerId, t])

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
    const trimmedPhone = form.phone.trim()

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          is_active: form.isActive === 'true',
        }),
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

  const disableForm = loading || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">{t('customer.editTitle')}</h2>
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
                  {t('common.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('common.name')}
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('common.emailPlaceholder')}
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-phone"
                  name="phone"
                  type="text"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter phone"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.status')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-isActive"
                  name="isActive"
                  value={form.isActive}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="true">{t('common.active')}</option>
                  <option value="false">{t('common.inactive')}</option>
                </select>
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
              {submitting ? t('common.saving') : t('customer.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

