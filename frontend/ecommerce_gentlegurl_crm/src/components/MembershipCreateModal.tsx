'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { MembershipRowData } from './MembershipRow'
import { mapMembershipApiItemToRow, type MembershipApiItem } from './membershipUtils'
import { useI18n } from '@/lib/i18n'

interface MembershipCreateModalProps {
  onClose: () => void
  onSuccess: (membership: MembershipRowData) => void
}

interface FormState {
  tier: string
  displayName: string
  description: string
  minSpentLastXMonths: string
  monthsWindow: string
  multiplier: string
}

const initialFormState: FormState = {
  tier: '',
  displayName: '',
  description: '',
  minSpentLastXMonths: '0',
  monthsWindow: '6',
  multiplier: '1.00',
}

export default function MembershipCreateModal({
  onClose,
  onSuccess,
}: MembershipCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTier = form.tier.trim()
    const trimmedDisplayName = form.displayName.trim()
    const trimmedDescription = form.description.trim()
    const minSpent = Number.parseFloat(form.minSpentLastXMonths) || 0
    const monthsWindow = Number.parseInt(form.monthsWindow, 10) || 6
    const multiplier = Number.parseFloat(form.multiplier) || 1.0

    if (!trimmedTier || !trimmedDisplayName) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/membership-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          tier: trimmedTier,
          display_name: trimmedDisplayName,
          description: trimmedDescription || null,
          badge_image_path: null,
          min_spent_last_x_months: minSpent,
          months_window: monthsWindow,
          multiplier: multiplier,
          is_active: true,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create membership tier'
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
          ? ((data as { data?: MembershipApiItem | null }).data ?? null)
          : null

      const membershipRow: MembershipRowData = payload
        ? mapMembershipApiItemToRow(payload)
        : {
            id: 0,
            tier: trimmedTier,
            displayName: trimmedDisplayName,
            description: trimmedDescription,
            minSpent: minSpent.toFixed(2),
            monthsWindow: monthsWindow,
            multiplier: multiplier.toFixed(2),
            discountPercent: '0',
            isActive: true,
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          }

      setForm({ ...initialFormState })
      onSuccess(membershipRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create membership tier')
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
          <h2 className="text-lg font-semibold">Create Membership Tier</h2>
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
              htmlFor="tier"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tier <span className="text-red-500">*</span>
            </label>
            <input
              id="tier"
              name="tier"
              type="text"
              value={form.tier}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Tier (e.g., normal, silver, gold)"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={form.displayName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Display Name"
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
              placeholder="Description"
              rows={3}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="minSpentLastXMonths"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Min Spent Last X Months
            </label>
            <input
              id="minSpentLastXMonths"
              name="minSpentLastXMonths"
              type="number"
              step="0.01"
              value={form.minSpentLastXMonths}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="monthsWindow"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Months Window
            </label>
            <input
              id="monthsWindow"
              name="monthsWindow"
              type="number"
              value={form.monthsWindow}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="6"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="multiplier"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Multiplier
            </label>
            <input
              id="multiplier"
              name="multiplier"
              type="number"
              step="0.01"
              value={form.multiplier}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="1.00"
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

