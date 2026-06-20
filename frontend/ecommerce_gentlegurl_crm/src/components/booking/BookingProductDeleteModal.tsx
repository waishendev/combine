'use client'

import CrmFormModalShell from '@/components/CrmFormModalShell'
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
    <CrmFormModalShell
      title="Delete booking product"
      onClose={onClose}
      footer={
        <>
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
        </>
      }
    >
      <div className="space-y-3 px-5 py-4 text-sm text-gray-700">
        <p>
          Delete <span className="font-semibold">{product.name}</span>?
        </p>
        <p className="text-xs text-gray-500">This action cannot be undone.</p>
      </div>
    </CrmFormModalShell>
  )
}
