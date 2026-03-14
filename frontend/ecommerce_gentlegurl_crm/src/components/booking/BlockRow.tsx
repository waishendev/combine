'use client'

import { useI18n } from '@/lib/i18n'

export interface BlockRowData {
  id: number
  scope: 'STORE' | 'STAFF'
  staff_id: number | null
  staff_name: string | null
  start_at: string
  end_at: string
  reason: string | null
}

interface BlockRowProps {
  block: BlockRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (block: BlockRowData) => void
  onDelete?: (block: BlockRowData) => void
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function BlockRow({
  block,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: BlockRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{block.scope}</td>
      <td className="px-4 py-2 border border-gray-200">{block.staff_name || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDateTime(block.start_at)}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDateTime(block.end_at)}</td>
      <td className="px-4 py-2 border border-gray-200">{block.reason || '-'}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(block)}
                aria-label={t('common.edit')}
                title={t('common.edit')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(block)}
                aria-label={t('common.delete')}
                title={t('common.delete')}
              >
                <i className="fa-solid fa-trash" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
