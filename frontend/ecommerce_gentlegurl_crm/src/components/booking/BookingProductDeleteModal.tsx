'use client'

import type { BookingProductRowData } from './bookingProductTypes'

type Props = {
  show: boolean
  product: BookingProductRowData
  onClose: () => void
  onDeleted: () => Promise<void> | void
}

export default function BookingProductDeleteModal({ show, product, onClose, onDeleted }: Props) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Delete booking product</h2>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700 space-y-3">
          <p>
            Delete <span className="font-semibold">{product.name}</span>?
          </p>
          <p className="text-xs text-gray-500">This action cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onDeleted()
              onClose()
            }}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

