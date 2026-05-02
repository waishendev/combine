'use client'

import { FormEvent, useEffect, useState } from 'react'

import type { BookingProductCategoryRowData } from './bookingProductCategoryRow'
import {
  mapBookingProductCategoryApiItemToRow,
  type BookingProductCategoryApiItem,
} from './bookingProductCategoryUtils'
import { useI18n } from '@/lib/i18n'

interface Props {
  category: BookingProductCategoryRowData
  onClose: () => void
  onSuccess: (category: BookingProductCategoryRowData) => void
}

export default function BookingProductCategoryEditModal({ category, onClose, onSuccess }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState(category.name)
  const [isActive, setIsActive] = useState(category.isActive)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(category.name)
    setIsActive(category.isActive)
  }, [category])

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

      const res = await fetch(`/api/proxy/admin/booking/product-categories/${category.id}`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Failed to update category.'
        throw new Error(msg)
      }
      const payload = json?.data ?? json
      const row = mapBookingProductCategoryApiItemToRow(payload as BookingProductCategoryApiItem)
      onSuccess(row)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Edit Product Category</h2>
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
            <label htmlFor="pc-edit-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="pc-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="pc-edit-status" className="mb-1 block text-sm font-medium text-gray-700">
              {t('common.status')}
            </label>
            <select
              id="pc-edit-status"
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
              {submitting ? 'Saving…' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
