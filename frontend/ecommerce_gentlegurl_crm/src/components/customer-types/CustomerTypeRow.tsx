'use client'

import type { CustomerTypeRowData } from './customerTypeUtils'

interface CustomerTypeRowProps {
  row: CustomerTypeRowData
  canUpdate?: boolean
  onEdit?: (row: CustomerTypeRowData) => void
}

export default function CustomerTypeRow({
  row,
  canUpdate = false,
  onEdit,
}: CustomerTypeRowProps) {
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{row.name}</td>
      <td className="px-4 py-2 border border-gray-200">{row.createdAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{row.updatedAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => onEdit?.(row)}
            aria-label="Edit"
            title="Edit"
          >
            <i className="fa-solid fa-pen-to-square" />
          </button>
        ) : (
          '-'
        )}
      </td>
    </tr>
  )
}
