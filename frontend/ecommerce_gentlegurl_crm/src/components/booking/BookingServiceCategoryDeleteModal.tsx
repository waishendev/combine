'use client'

import { useState } from 'react'

import type { BookingServiceCategoryRowData } from './BookingServiceCategoryRow'
import { useI18n } from '@/lib/i18n'

interface BookingServiceCategoryDeleteModalProps {
  category: BookingServiceCategoryRowData
  onClose: () => void
  onSuccess: (categoryId: number) => void
}

export default function BookingServiceCategoryDeleteModal({
  category,
  onClose,
  onSuccess,
}: BookingServiceCategoryDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/admin/booking/categories/${category.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
            ? (data as { message: string }).message
            : t('common.deleteError')
        throw new Error(message)
      }
      onSuccess(category.id)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.deleteError')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Delete category</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className="text-sm text-gray-700">Are you sure you want to delete this category?</p>
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <div className="font-medium">{category.name}</div>
          <div className="text-xs text-gray-500">/{category.slug}</div>
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
