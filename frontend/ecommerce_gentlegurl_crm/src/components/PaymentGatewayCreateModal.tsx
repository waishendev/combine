'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { PaymentGatewayRowData } from './PaymentGatewayRow'
import { mapPaymentGatewayApiItemToRow, type PaymentGatewayApiItem } from './paymentGatewayUtils'
import { useI18n } from '@/lib/i18n'

interface PaymentGatewayCreateModalProps {
  onClose: () => void
  onSuccess: (paymentGateway: PaymentGatewayRowData) => void
}

interface FormState {
  key: string
  name: string
  isActive: 'active' | 'inactive'
  isDefault: 'yes' | 'no'
}

const initialFormState: FormState = {
  key: '',
  name: '',
  isActive: 'active',
  isDefault: 'no',
}

export default function PaymentGatewayCreateModal({
  onClose,
  onSuccess,
}: PaymentGatewayCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedKey = form.key.trim()
    const trimmedName = form.name.trim()

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/payment-gateways', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: trimmedKey,
          name: trimmedName,
          is_active: form.isActive === 'active',
          is_default: form.isDefault === 'yes',
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create payment gateway'
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
          ? ((data as { data?: PaymentGatewayApiItem | null }).data ?? null)
          : null

      const paymentGatewayRow: PaymentGatewayRowData = payload
        ? mapPaymentGatewayApiItemToRow(payload)
        : {
            id: 0,
            key: trimmedKey,
            name: trimmedName,
            isActive: form.isActive === 'active',
            isDefault: form.isDefault === 'yes',
            sort_order: null,
            createdAt: '',
            updatedAt: '',
          }

      setForm({ ...initialFormState })
      onSuccess(paymentGatewayRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create payment gateway')
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Payment Gateway</h2>
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
          <div className="space-y-4">
            <div>
              <label
                htmlFor="key"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Key <span className="text-red-500">*</span>
              </label>
              <input
                id="key"
                name="key"
                type="text"
                value={form.key}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., billplz_fpx"
                required
                disabled={submitting}
              />
            </div>

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
                placeholder="e.g., Online Banking (Billplz FPX)"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor="isActive"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Status
              </label>
              <select
                id="isActive"
                name="isActive"
                value={form.isActive}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="isDefault"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Default Gateway
              </label>
              <select
                id="isDefault"
                name="isDefault"
                value={form.isDefault}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>

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
              disabled={submitting}
            >
              {submitting ? 'Creating...' : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

