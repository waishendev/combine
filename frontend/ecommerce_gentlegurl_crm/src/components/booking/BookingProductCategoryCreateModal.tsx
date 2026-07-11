'use client'

import { FormEvent, useState } from 'react'

import type { BookingProductCategoryRowData } from './BookingProductCategoryRow'
import {
  mapBookingProductCategoryApiItemToRow,
  type BookingProductCategoryApiItem,
} from './bookingProductCategoryUtils'
import CrmFormModalShell from '@/components/CrmFormModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  onClose: () => void
  onSuccess: (category: BookingProductCategoryRowData) => void
}

export default function BookingProductCategoryCreateModal({ onClose, onSuccess }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [cnName, setCnName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [showInPosFilter, setShowInPosFilter] = useState(true)
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
        cn_name: cnName.trim() || null,
        is_active: isActive,
        show_in_pos_filter: showInPosFilter,
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
    <CrmFormModalShell
      title="Create Product Category"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel="Close"
      footer={
        <>
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
            form="booking-product-category-create-form"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Create'}
          </button>
        </>
      }
    >
      <form id="booking-product-category-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="pc-create-name" className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="pc-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="English category name"
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="pc-create-cn-name" className="mb-1 block text-sm font-medium text-gray-700">
              CN Name
            </label>
            <input
              id="pc-create-cn-name"
              value={cnName}
              onChange={(e) => setCnName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="中文分类名称"
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
          <div>
            <label htmlFor="pc-create-pos-filter" className="mb-1 block text-sm font-medium text-gray-700">
              Show in POS filter
            </label>
            <select
              id="pc-create-pos-filter"
              value={showInPosFilter ? 'enabled' : 'disabled'}
              onChange={(e) => setShowInPosFilter(e.target.value === 'enabled')}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
      </form>
    </CrmFormModalShell>
  )
}
