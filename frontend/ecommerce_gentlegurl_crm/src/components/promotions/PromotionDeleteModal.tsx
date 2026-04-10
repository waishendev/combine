'use client'

import { useState } from 'react'

import type { PromotionRowData } from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionDeleteModalProps {
  promotion: PromotionRowData
  onClose: () => void
  onDeleted: (promotionId: number) => void
}

export default function PromotionDeleteModal({
  promotion,
  onClose,
  onDeleted,
}: PromotionDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/promotions/${promotion.id}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
        },
      )

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object' && 'message' in data) {
          const msg = data.message
          if (typeof msg === 'string') {
            setError(msg)
            return
          }
        }
        setError('Failed to delete promotion.')
        return
      }

      onDeleted(promotion.id)
    } catch (err) {
      console.error(err)
      setError('Failed to delete promotion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('common.delete')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <p className="text-sm text-gray-700">
            Delete promotion &quot;{promotion.name}&quot;? This cannot be undone.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-300 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Deleting…' : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
