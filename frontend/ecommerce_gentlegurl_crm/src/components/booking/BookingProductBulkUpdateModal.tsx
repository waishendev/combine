'use client'

import { useMemo, useState } from 'react'

import BookingProductCategoryPicker from './BookingProductCategoryPicker'
import type { BookingProductCategory, BookingProductRowData } from './bookingProductTypes'

type FieldKey = 'name' | 'price' | 'category_id' | 'is_active'

const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
  { key: 'category_id', label: 'Category' },
  { key: 'is_active', label: 'Status' },
]

type Props = {
  show: boolean
  selectedProducts: BookingProductRowData[]
  categories: BookingProductCategory[]
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export default function BookingProductBulkUpdateModal({
  show,
  selectedProducts,
  categories,
  onClose,
  onSuccess,
}: Props) {
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState<'true' | 'false'>('true')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countText = useMemo(
    () => `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected`,
    [selectedProducts.length],
  )

  const toggleField = (key: FieldKey) => {
    setSelectedFields((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleSubmit = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to update.')
      return
    }

    if (selectedFields.includes('price')) {
      const p = Number(price)
      if (!Number.isFinite(p) || p < 0) {
        setError('Price must be 0 or greater.')
        return
      }
    }

    if (selectedFields.includes('name') && !name.trim()) {
      setError('Name cannot be empty.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ids: selectedProducts.map((p) => p.id),
      }

      if (selectedFields.includes('name')) payload.name = name.trim()
      if (selectedFields.includes('price')) payload.price = Number(price)
      if (selectedFields.includes('category_id')) payload.category_ids = categoryId ? [Number(categoryId)] : []
      if (selectedFields.includes('is_active')) payload.is_active = isActive === 'true'

      const res = await fetch('/api/proxy/admin/booking/products/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const msg =
          (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Update Booking Products</h2>
            <p className="text-sm text-gray-500">{countText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close bulk update"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="max-h-[calc(85vh-64px-72px)] overflow-y-auto px-6 py-4 space-y-4">
          {error && <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="border rounded p-2 bg-gray-50 max-h-[180px] overflow-y-auto text-sm text-gray-700">
            {selectedProducts.map((p) => (
              <div key={p.id} className="mb-3 border-b border-gray-200 pb-2 last:border-none last:pb-0">
                <div className="font-medium text-gray-800">{p.name}</div>
                <div className="text-xs text-gray-500">#{p.id} • RM {Number(p.price || 0).toFixed(2)} • {(p.categories ?? []).map((c) => c.name).join(', ') || '-'}</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-800 mb-3">
              Select Fields to Update <span className="text-gray-500">(you can choose more than one)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {FIELD_OPTIONS.map((field) => {
                const isSelected = selectedFields.includes(field.key)
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => toggleField(field.key)}
                    className={`group flex items-center gap-3 p-4 rounded-xl border transition shadow-sm ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
                        : 'bg-white hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-xs font-bold ${
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
            {selectedFields.includes('name') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                />
              </div>
            )}

            {selectedFields.includes('price') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Price</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                />
              </div>
            )}

            {selectedFields.includes('category_id') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                <BookingProductCategoryPicker
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  disabled={submitting}
                  emptyLabel="No category"
                />
              </div>
            )}

            {selectedFields.includes('is_active') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={isActive}
                  onChange={(e) => setIsActive(e.target.value as 'true' | 'false')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

