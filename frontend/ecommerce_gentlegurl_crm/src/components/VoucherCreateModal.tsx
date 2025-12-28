'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { VoucherRowData } from './VoucherRow'
import { mapVoucherApiItemToRow, type VoucherApiItem } from './voucherUtils'
import { useI18n } from '@/lib/i18n'

interface VoucherCreateModalProps {
  onClose: () => void
  onSuccess: (voucher: VoucherRowData) => void
  isRewardOnly?: boolean
}

interface FormState {
  code: string
  amount: string
  minOrderAmount: string
  maxUses: string
  maxUsesPerCustomer: string
  startAt: string
  endAt: string
}

const initialFormState: FormState = {
  code: '',
  amount: '',
  minOrderAmount: '',
  maxUses: '',
  maxUsesPerCustomer: '',
  startAt: '',
  endAt: '',
}

export default function VoucherCreateModal({
  onClose,
  onSuccess,
  isRewardOnly,
}: VoucherCreateModalProps) {
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

    const trimmedCode = form.code.trim()
    const amountNum = parseFloat(form.amount)
    const minOrderAmountNum = parseFloat(form.minOrderAmount)
    const maxUsesNum = parseInt(form.maxUses, 10)
    const maxUsesPerCustomerNum = parseInt(form.maxUsesPerCustomer, 10)

    if (
      !trimmedCode ||
      !Number.isFinite(amountNum) ||
      !Number.isFinite(minOrderAmountNum) ||
      !Number.isFinite(maxUsesNum) ||
      !Number.isFinite(maxUsesPerCustomerNum) ||
      !form.startAt ||
      !form.endAt
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          code: trimmedCode,
          type: 'fixed_amount',
          amount: amountNum,
          min_order_amount: minOrderAmountNum,
          max_uses: maxUsesNum,
          max_uses_per_customer: maxUsesPerCustomerNum,
          start_at: form.startAt,
          end_at: form.endAt,
          is_active: true,
          ...(isRewardOnly !== undefined ? { is_reward_only: isRewardOnly } : {}),
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create voucher'
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
          ? ((data as { data?: VoucherApiItem | null }).data ?? null)
          : null

      const voucherRow: VoucherRowData = payload
        ? mapVoucherApiItemToRow(payload)
        : {
            id: 0,
            code: trimmedCode,
            type: 'fixed_amount',
            amount: amountNum.toFixed(2),
            maxUses: String(maxUsesNum),
            maxUsesPerCustomer: String(maxUsesPerCustomerNum),
            minOrderAmount: minOrderAmountNum.toFixed(2),
            startAt: form.startAt,
            endAt: form.endAt,
            isActive: true,
          }

      setForm({ ...initialFormState })
      onSuccess(voucherRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create voucher')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Voucher</h2>
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
              htmlFor="code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Code <span className="text-red-500">*</span>
            </label>
            <input
              id="code"
              name="code"
              type="text"
              value={form.code}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Voucher code"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="minOrderAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Minimum Order Amount <span className="text-red-500">*</span>
            </label>
            <input
              id="minOrderAmount"
              name="minOrderAmount"
              type="number"
              step="0.01"
              min="0"
              value={form.minOrderAmount}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="maxUses"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Max Uses <span className="text-red-500">*</span>
            </label>
            <input
              id="maxUses"
              name="maxUses"
              type="number"
              min="1"
              value={form.maxUses}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="100"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="maxUsesPerCustomer"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Max Uses Per Customer <span className="text-red-500">*</span>
            </label>
            <input
              id="maxUsesPerCustomer"
              name="maxUsesPerCustomer"
              type="number"
              min="1"
              value={form.maxUsesPerCustomer}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="1"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="startAt"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="startAt"
              name="startAt"
              type="date"
              value={form.startAt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="endAt"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="endAt"
              name="endAt"
              type="date"
              value={form.endAt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            />
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
