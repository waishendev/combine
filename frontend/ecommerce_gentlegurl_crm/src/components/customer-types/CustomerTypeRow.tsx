'use client'

import type { CustomerTypeRowData } from './customerTypeUtils'

interface CustomerTypeRowProps {
  row: CustomerTypeRowData
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (row: CustomerTypeRowData) => void
  onDelete?: (row: CustomerTypeRowData) => void
}

export default function CustomerTypeRow({
  row,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: CustomerTypeRowProps) {
  const showActions = canUpdate || canDelete
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{row.name}</td>
      <td className="px-4 py-2 border border-gray-200">{row.createdAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{row.updatedAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">
        {showActions ? (
          <div className="flex items-center gap-2">
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
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(row)}
                aria-label="Delete"
                title="Delete"
              >
                <i className="fa-solid fa-trash" />
              </button>
            ) : null}
          </div>
        ) : (
          '-'
        )}
      </td>
    </tr>
  )
}
