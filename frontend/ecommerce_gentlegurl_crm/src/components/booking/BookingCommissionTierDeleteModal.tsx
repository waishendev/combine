'use client'

import { useState } from 'react'

import type { CommissionTierRow } from './BookingCommissionTierCreateModal'
import { useI18n } from '@/lib/i18n'

interface BookingCommissionTierDeleteModalProps {
  tier: CommissionTierRow
  onClose: () => void
  onSuccess: (tierId: number) => void
}

export default function BookingCommissionTierDeleteModal({
  tier,
  onClose,
  onSuccess,
}: BookingCommissionTierDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commission-tiers/${tier.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })

      const json = await res.json().catch(() => null)
      if (json && typeof json === 'object' && json?.success === false && json?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }
      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && typeof (json as { message?: unknown }).message === 'string'
            ? (json as { message: string }).message
            : t('common.deleteError')
        throw new Error(msg)
      }

      onSuccess(tier.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deleteError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Delete commission tier</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.close')}
            disabled={submitting}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className="text-sm text-gray-700">Are you sure you want to delete this commission tier?</p>
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Min Sales:</span> RM {Number(tier.min_sales).toFixed(2)}
          </div>
          <div>
            <span className="font-medium">Commission:</span> {Number(tier.commission_percent).toFixed(2)}%
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

