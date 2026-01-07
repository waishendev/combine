'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { PaymentGatewayRowData } from './PaymentGatewayRow'
import { mapPaymentGatewayApiItemToRow, type PaymentGatewayApiItem } from './paymentGatewayUtils'
import { useI18n } from '@/lib/i18n'

interface PaymentGatewayEditModalProps {
  paymentGatewayId: number
  onClose: () => void
  onSuccess: (paymentGateway: PaymentGatewayRowData) => void
}

interface FormState {
  name: string
  isActive: 'active' | 'inactive'
  isDefault: 'yes' | 'no'
}

const initialFormState: FormState = {
  name: '',
  isActive: 'active',
  isDefault: 'no',
}

export default function PaymentGatewayEditModal({
  paymentGatewayId,
  onClose,
  onSuccess,
}: PaymentGatewayEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedPaymentGateway, setLoadedPaymentGateway] = useState<PaymentGatewayRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadPaymentGateway = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/payment-gateways/${paymentGatewayId}`, {
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
          setError('Failed to load payment gateway')
          return
        }

        const paymentGateway = data?.data as PaymentGatewayApiItem | undefined
        if (!paymentGateway || typeof paymentGateway !== 'object') {
          setError('Failed to load payment gateway')
          return
        }

        const mappedPaymentGateway = mapPaymentGatewayApiItemToRow(paymentGateway)
        setLoadedPaymentGateway(mappedPaymentGateway)

        setForm({
          name: typeof paymentGateway.name === 'string' ? paymentGateway.name : '',
          isActive:
            paymentGateway.is_active === true || paymentGateway.is_active === 'true' || paymentGateway.is_active === 1
              ? 'active'
              : 'inactive',
          isDefault:
            paymentGateway.is_default === true || paymentGateway.is_default === 'true' || paymentGateway.is_default === 1
              ? 'yes'
              : 'no',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load payment gateway')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPaymentGateway().catch(() => {
      setLoading(false)
      setError('Failed to load payment gateway')
    })

    return () => controller.abort()
  }, [paymentGatewayId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/ecommerce/payment-gateways/${paymentGatewayId}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          is_active: form.isActive === 'active',
          is_default: form.isDefault === 'yes',
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
        setError('Failed to update payment gateway')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: PaymentGatewayApiItem | null }).data ?? null)
          : null

      const paymentGatewayRow: PaymentGatewayRowData = payloadData
        ? mapPaymentGatewayApiItemToRow(payloadData)
        : {
            id: loadedPaymentGateway?.id ?? paymentGatewayId,
            key: loadedPaymentGateway?.key ?? '',
            name: trimmedName,
            isActive: form.isActive === 'active',
            isDefault: form.isDefault === 'yes',
            sort_order: loadedPaymentGateway?.sort_order ?? null,
            createdAt: loadedPaymentGateway?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedPaymentGateway(paymentGatewayRow)
      onSuccess(paymentGatewayRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update payment gateway')
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Payment Gateway</h2>
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

        <form onSubmit={handleSubmit} className="p-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading payment gateway details...</div>
          ) : (
            <>
              <div className="space-y-4">
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
                    placeholder="e.g., Online Banking (Billplz FPX)"
                    required
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-isActive"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-isActive"
                    name="isActive"
                    value={form.isActive}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="active">{t('common.active')}</option>
                    <option value="inactive">{t('common.inactive')}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-isDefault"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Default Gateway
                  </label>
                  <select
                    id="edit-isDefault"
                    name="isDefault"
                    value={form.isDefault}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 mt-4" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
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

