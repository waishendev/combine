'use client'

import StatusBadge from '@/components/StatusBadge'
import { useI18n } from '@/lib/i18n'

import type { BookingServiceCategoryRowData } from './bookingServiceCategoryUtils'

export type { BookingServiceCategoryRowData }

interface BookingServiceCategoryRowProps {
  category: BookingServiceCategoryRowData
  showActions?: boolean
  showSelection?: boolean
  selected?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isFirst?: boolean
  isLast?: boolean
  onSelectChange?: (category: BookingServiceCategoryRowData, checked: boolean) => void
  onEdit?: (category: BookingServiceCategoryRowData) => void
  onDelete?: (category: BookingServiceCategoryRowData) => void
  onMoveUp?: (category: BookingServiceCategoryRowData) => void
  onMoveDown?: (category: BookingServiceCategoryRowData) => void
}

export default function BookingServiceCategoryRow({
  category,
  showActions = false,
  showSelection = false,
  selected = false,
  canUpdate = false,
  canDelete = false,
  isFirst = false,
  isLast = false,
  onSelectChange,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BookingServiceCategoryRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      {showSelection && (
        <td className="border border-gray-200 px-4 py-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={selected}
            onChange={(e) => onSelectChange?.(category, e.target.checked)}
            aria-label={`Select ${category.name}`}
          />
        </td>
      )}
      <td className="px-4 py-2 border border-gray-200">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="h-10 w-10 rounded object-cover border border-gray-200 bg-gray-50"
          />
        ) : (
          <div className="h-10 w-10 rounded border border-dashed border-gray-300 bg-gray-100" aria-hidden />
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200"><div>{category.name}</div>{category.cnName ? <div className="mt-0.5">{category.cnName}</div> : null}</td>
      <td className="px-4 py-2 border border-gray-200">{category.slug}</td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <div className="flex items-center gap-3 justify-left">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(category)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {category.sortOrder != null ? category.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(category)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{category.sortOrder != null ? category.sortOrder : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={category.showInPosFilter ? 'active' : 'inactive'}
          label={category.showInPosFilter ? 'Yes' : 'No'}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={category.isActive ? 'active' : 'inactive'}
          label={category.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                onClick={() => onEdit?.(category)}
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                aria-label="Edit"
                title="Edit"
              >
                <i className="fa-solid fa-pen" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(category)}
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                aria-label="Delete"
                title="Delete"
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
