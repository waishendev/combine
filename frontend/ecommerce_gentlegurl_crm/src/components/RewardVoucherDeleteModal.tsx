'use client'

import { useState } from 'react'

import { useI18n } from '@/lib/i18n'

interface RewardVoucherDeleteModalProps {
  title: string
  rewardId: number
  voucherId: number
  onClose: () => void
  onDeleted: () => void
}

export default function RewardVoucherDeleteModal({
  title,
  rewardId,
  voucherId,
  onClose,
  onDeleted,
}: RewardVoucherDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const rewardRes = await fetch(`/api/proxy/ecommerce/loyalty/rewards/${rewardId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!rewardRes.ok) {
        const data = await rewardRes.json().catch(() => null)
        const message =
          data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : 'Failed to delete reward'
        setError(message)
        return
      }

      const voucherRes = await fetch(`/api/proxy/ecommerce/vouchers/${voucherId}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!voucherRes.ok) {
        setError('Failed to delete voucher')
        return
      }

      onDeleted()
    } catch (err) {
      console.error(err)
      setError('Failed to delete reward')
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
      <div className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Delete Reward</h2>
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

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-700">Are you sure you want to delete this reward?</p>
          <div className="rounded-md bg-yellow-100 px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">{title}</p>
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
              type="button"
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? 'Deleting...' : t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
