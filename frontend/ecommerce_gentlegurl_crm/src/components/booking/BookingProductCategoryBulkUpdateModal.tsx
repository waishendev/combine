'use client'

import { useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import type { BookingProductCategoryRowData } from './bookingProductCategoryUtils'

type FieldKey = 'is_active' | 'show_in_pos_filter'

const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: 'is_active', label: 'Status' },
  { key: 'show_in_pos_filter', label: 'Show in POS filter' },
]

type Props = {
  show: boolean
  selectedCategories: BookingProductCategoryRowData[]
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export default function BookingProductCategoryBulkUpdateModal({
  show,
  selectedCategories,
  onClose,
  onSuccess,
}: Props) {
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>([])
  const [isActive, setIsActive] = useState<'true' | 'false'>('true')
  const [showInPosFilter, setShowInPosFilter] = useState<'true' | 'false'>('true')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countText = useMemo(
    () =>
      `${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} selected`,
    [selectedCategories.length],
  )

  const toggleField = (key: FieldKey) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleSubmit = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to update.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ids: selectedCategories.map((c) => c.id),
      }

      if (selectedFields.includes('is_active')) payload.is_active = isActive === 'true'
      if (selectedFields.includes('show_in_pos_filter')) payload.show_in_pos_filter = showInPosFilter === 'true'

      const res = await fetch('/api/proxy/admin/booking/product-categories/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const msg =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Bulk update failed. Please retry.'
        setError(msg)
        return
      }

      await onSuccess()
      onClose()
    } catch (e) {
      console.error(e)
      setError('Bulk update failed. Please retry.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!show) return null

  return (
    <CrmFormModalShell
      size="lg"
      title={
        <>
          Bulk Update Categories
          <span className="mt-0.5 block text-sm font-normal text-gray-500">{countText}</span>
        </>
      }
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel="Close bulk update"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        {error ? (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="max-h-[180px] overflow-y-auto rounded border bg-gray-50 p-2 text-sm text-gray-700">
          {selectedCategories.map((c) => (
            <div key={c.id} className="mb-3 border-b border-gray-200 pb-2 last:mb-0 last:border-none last:pb-0">
              <div className="font-medium text-gray-800">{c.name}</div>
              <div className="text-xs text-gray-500">
                #{c.id} • {c.isActive ? 'Active' : 'Inactive'} • POS filter: {c.showInPosFilter ? 'Yes' : 'No'}
              </div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-md mb-3 font-semibold text-gray-800">
            Select fields to update{' '}
            <span className="font-normal text-gray-500">(you can choose more than one)</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_OPTIONS.map((field) => {
              const isSelected = selectedFields.includes(field.key)
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={`group flex items-center gap-3 rounded-xl border p-4 shadow-sm transition ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                      isSelected ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-gray-400'
                    }`}
                  >
                    ✓
                  </div>
                  <span className="text-sm font-medium text-gray-800">{field.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          {selectedFields.includes('is_active') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value as 'true' | 'false')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}

          {selectedFields.includes('show_in_pos_filter') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Show in POS filter</label>
              <select
                value={showInPosFilter}
                onChange={(e) => setShowInPosFilter(e.target.value as 'true' | 'false')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </CrmFormModalShell>
  )
}
