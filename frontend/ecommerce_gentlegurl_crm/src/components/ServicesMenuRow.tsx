'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface ServicesMenuRowData {
  id: number
  name: string
  slug: string
  sortOrder: number | null
  isActive: boolean
}

interface ServicesMenuRowProps {
  servicesMenu: ServicesMenuRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (servicesMenu: ServicesMenuRowData) => void
  onDelete?: (servicesMenu: ServicesMenuRowData) => void
  onMoveUp?: (servicesMenu: ServicesMenuRowData) => void
  onMoveDown?: (servicesMenu: ServicesMenuRowData) => void
}

export default function ServicesMenuRow({
  servicesMenu,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ServicesMenuRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{servicesMenu.name}</td>
      <td className="px-4 py-2 border border-gray-200">{servicesMenu.slug}</td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <div className="flex items-center gap-3 justify-left">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(servicesMenu)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {servicesMenu.sortOrder != null ? servicesMenu.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(servicesMenu)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{servicesMenu.sortOrder != null ? servicesMenu.sortOrder : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={servicesMenu.isActive ? 'active' : 'inactive'}
          label={servicesMenu.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                onClick={() => onEdit?.(servicesMenu)}
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
                onClick={() => onDelete?.(servicesMenu)}
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
