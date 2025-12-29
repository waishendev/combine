'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface MembershipRowData {
  id: number
  tier: string
  displayName: string
  description: string
  minSpent: string
  monthsWindow: number
  multiplier: string
  discountPercent: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface MembershipRowProps {
  membership: MembershipRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canMove?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (membership: MembershipRowData) => void
  onDelete?: (membership: MembershipRowData) => void
  onMoveUp?: (membership: MembershipRowData) => void
  onMoveDown?: (membership: MembershipRowData) => void
}

export default function MembershipRow({
  membership,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canMove = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: MembershipRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{membership.tier}</td>
      <td className="px-4 py-2 border border-gray-200">{membership.displayName}</td>
      <td className="px-4 py-2 border border-gray-200">{membership.description}</td>
      <td className="px-4 py-2 border border-gray-200">{membership.minSpent}</td>
      <td className="px-4 py-2 border border-gray-200">{membership.monthsWindow}</td>
      <td className="px-4 py-2 border border-gray-200">{membership.multiplier}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={membership.isActive ? 'active' : 'inactive'}
          label={membership.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {canMove ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(membership)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {membership.sortOrder != null ? membership.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(membership)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{membership.sortOrder != null ? membership.sortOrder : '-'}</span>
        )}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(membership)}
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
                onClick={() => onDelete?.(membership)}
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

