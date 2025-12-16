'use client'

import { useI18n } from '@/lib/i18n'

export interface PermissionGroupRowData {
  id: number
  name: string
  sortOrder: number | null
  createdAt: string
  updatedAt: string
}

interface PermissionGroupRowProps {
  group: PermissionGroupRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (group: PermissionGroupRowData) => void
  onDelete?: (group: PermissionGroupRowData) => void
  onMoveUp?: (group: PermissionGroupRowData) => void
  onMoveDown?: (group: PermissionGroupRowData) => void
}

export default function PermissionGroupRow({
  group,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PermissionGroupRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{group.name}</td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(group)}
              disabled={isFirst}
              aria-label={t('permissionGroup.moveUp')}
              title={t('permissionGroup.moveUp')}
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {group.sortOrder != null ? group.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(group)}
              disabled={isLast}
              aria-label={t('permissionGroup.moveDown')}
              title={t('permissionGroup.moveDown')}
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{group.sortOrder != null ? group.sortOrder : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{group.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{group.updatedAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(group)}
                aria-label={t('permissionGroup.editAction')}
                title={t('permissionGroup.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(group)}
                aria-label={t('permissionGroup.deleteAction')}
                title={t('permissionGroup.deleteAction')}
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

