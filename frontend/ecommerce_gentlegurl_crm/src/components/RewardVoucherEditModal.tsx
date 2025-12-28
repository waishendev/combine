'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import { useI18n } from '@/lib/i18n'

export type RewardVoucherRow = {
  rewardId: number
  voucherId: number
  title: string
  description: string
  pointsRequired: number
  quotaUsed: number | null
  quotaTotal: number | null
  isActive: boolean
  code: string
  value: string
  minOrderAmount: string
  startAt: string
  endAt: string
}

const generateVoucherCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
  return `RW-${segment}`
}

interface RewardVoucherEditModalProps {
  reward: RewardVoucherRow
  onClose: () => void
  onSuccess: () => void
}

interface FormState {
  title: string
  description: string
  pointsRequired: string
  quotaTotal: string
  status: 'active' | 'inactive'
  code: string
  value: string
  minOrderAmount: string
  startAt: string
  endAt: string
}

export default function RewardVoucherEditModal({
  reward,
  onClose,
  onSuccess,
}: RewardVoucherEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({
    title: reward.title,
    description: reward.description,
    pointsRequired: reward.pointsRequired ? String(reward.pointsRequired) : '',
    quotaTotal: reward.quotaTotal != null ? String(reward.quotaTotal) : '',
    status: reward.isActive ? 'active' : 'inactive',
    code: reward.code,
    value: reward.value,
    minOrderAmount: reward.minOrderAmount,
    startAt: reward.startAt,
    endAt: reward.endAt,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = form.title.trim()
    const trimmedDescription = form.description.trim()
    const trimmedCode = form.code.trim()
    const pointsRequired = Number.parseInt(form.pointsRequired, 10)
    const valueNum = parseFloat(form.value)
    const minOrderAmountNum = parseFloat(form.minOrderAmount)
    const quotaTotal = form.quotaTotal.trim()
      ? Number.parseInt(form.quotaTotal, 10)
      : undefined

    if (
      !trimmedTitle ||
      !trimmedDescription ||
      !trimmedCode ||
      !Number.isFinite(pointsRequired) ||
      !Number.isFinite(valueNum) ||
      !Number.isFinite(minOrderAmountNum) ||
      !form.startAt ||
      !form.endAt
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const voucherRes = await fetch(`/api/proxy/ecommerce/vouchers/${reward.voucherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          code: trimmedCode,
          type: 'fixed',
          value: valueNum,
          min_order_amount: minOrderAmountNum,
          start_at: form.startAt,
          end_at: form.endAt,
          is_active: form.status === 'active',
          is_reward_only: true,
        }),
      })

      const voucherData = await voucherRes.json().catch(() => null)
      if (!voucherRes.ok) {
        let message = 'Failed to update voucher'
        if (voucherData && typeof voucherData === 'object') {
          if (typeof voucherData.message === 'string') {
            message = voucherData.message
          } else if ('errors' in voucherData && typeof voucherData.errors === 'object') {
            const errors = voucherData.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            const firstValue = firstKey ? errors[firstKey] : null
            if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
              message = firstValue[0]
            } else if (typeof firstValue === 'string') {
              message = firstValue
            }
          }
        }
        setError(message)
        return
      }

      const rewardRes = await fetch(`/api/proxy/ecommerce/loyalty/rewards/${reward.rewardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          type: 'voucher',
          points_required: pointsRequired,
          voucher_id: reward.voucherId,
          quota_total: quotaTotal,
          is_active: form.status === 'active',
        }),
      })

      const rewardData = await rewardRes.json().catch(() => null)
      if (!rewardRes.ok) {
        let message = 'Failed to update reward'
        if (rewardData && typeof rewardData === 'object') {
          if (typeof rewardData.message === 'string') {
            message = rewardData.message
          } else if ('errors' in rewardData && typeof rewardData.errors === 'object') {
            const errors = rewardData.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            const firstValue = firstKey ? errors[firstKey] : null
            if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
              message = firstValue[0]
            } else if (typeof firstValue === 'string') {
              message = firstValue
            }
          }
        }
        setError(message)
        return
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      setError('Failed to update reward voucher')
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Reward Voucher</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="description"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="pointsRequired"
              >
                Points Required <span className="text-red-500">*</span>
              </label>
              <input
                id="pointsRequired"
                name="pointsRequired"
                type="number"
                min="1"
                value={form.pointsRequired}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="quotaTotal">
                Total Quota
              </label>
              <input
                id="quotaTotal"
                name="quotaTotal"
                type="number"
                min="0"
                value={form.quotaTotal}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="code">
                  Code <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    value={form.code}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="whitespace-nowrap px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setForm((prev) => ({ ...prev, code: generateVoucherCode() }))}
                    disabled={submitting}
                  >
                    Auto-generate
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="value">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-gray-700"
                  htmlFor="minOrderAmount"
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
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="startAt">
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
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="endAt">
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
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
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
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
