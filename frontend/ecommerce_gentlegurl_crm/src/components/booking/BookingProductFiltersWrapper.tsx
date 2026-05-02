'use client'

import BookingProductCategoryPicker from './BookingProductCategoryPicker'
import type { BookingProductCategory } from './bookingProductTypes'

export type BookingProductFilterValues = {
  search: string
  status: '' | 'active' | 'inactive'
  category_id: string
}

type Props = {
  show: boolean
  inputs: BookingProductFilterValues
  categories: BookingProductCategory[]
  disabled?: boolean
  onChange: (next: BookingProductFilterValues) => void
  onSubmit: (next: BookingProductFilterValues) => void
  onReset: () => void
  onClose: () => void
}

export const emptyBookingProductFilters: BookingProductFilterValues = {
  search: '',
  status: '',
  category_id: '',
}

export default function BookingProductFiltersWrapper({
  show,
  inputs,
  categories,
  disabled = false,
  onChange,
  onSubmit,
  onReset,
  onClose,
}: Props) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Filter Booking Products</h2>
            <p className="text-sm text-gray-500">Narrow down results</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close filter modal"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Search</label>
              <input
                value={inputs.search}
                onChange={(e) => onChange({ ...inputs, search: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Name / barcode / category"
                disabled={disabled}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={inputs.status}
                onChange={(e) => onChange({ ...inputs, status: e.target.value as BookingProductFilterValues['status'] })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={disabled}
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <BookingProductCategoryPicker
                categories={categories}
                value={inputs.category_id}
                onChange={(categoryId) => onChange({ ...inputs, category_id: categoryId })}
                disabled={disabled}
                emptyLabel="All categories"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700"
            onClick={onReset}
            disabled={disabled}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => onSubmit(inputs)}
            disabled={disabled}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

