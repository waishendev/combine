'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface MarqueeRowData {
  id: number
  text: string
  startAt: string
  endAt: string
  isActive: boolean
  sortOrder: number | null
  createdAt: string
  updatedAt: string
}

interface MarqueeRowProps {
  marquee: MarqueeRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (marquee: MarqueeRowData) => void
  onDelete?: (marquee: MarqueeRowData) => void
  onMoveUp?: (marquee: MarqueeRowData) => void
  onMoveDown?: (marquee: MarqueeRowData) => void
}

export default function MarqueeRow({
  marquee,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: MarqueeRowProps) {
  const { t } = useI18n()

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{marquee.text}</td>
      <td className="px-4 py-2 border border-gray-200">{marquee.startAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{marquee.endAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={marquee.isActive ? 'active' : 'inactive'}
          label={marquee.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(marquee)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {marquee.sortOrder != null ? marquee.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(marquee)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{marquee.sortOrder != null ? marquee.sortOrder : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{marquee.createdAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{marquee.updatedAt || '-'}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(marquee)}
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
                onClick={() => onDelete?.(marquee)}
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

