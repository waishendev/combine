'use client'

import { FormEvent, useState } from 'react'

import type { BookingProductCategoryRowData } from './BookingProductCategoryRow'
import {
  mapBookingProductCategoryApiItemToRow,
  type BookingProductCategoryApiItem,
} from './bookingProductCategoryUtils'
import { useI18n } from '@/lib/i18n'

interface Props {
  onClose: () => void
  onSuccess: (category: BookingProductCategoryRowData) => void
}

export default function BookingProductCategoryCreateModal({ onClose, onSuccess }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        name: trimmed,
        is_active: isActive,
      }

      const res = await fetch('/api/proxy/admin/booking/product-categories', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Failed to create category.'
        throw new Error(msg)
      }
      const payload = json?.data ?? json
      const row = mapBookingProductCategoryApiItemToRow(payload as BookingProductCategoryApiItem)
      if (!row.id) throw new Error('Invalid response.')
      onSuccess(row)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Create Product Category</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pc-create-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="pc-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Category name"
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="pc-create-status" className="mb-1 block text-sm font-medium text-gray-700">
              {t('common.status')}
            </label>
            <select
              id="pc-create-status"
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
