'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface ShopMenuRowData {
  id: number
  name: string
  slug: string
  sortOrder: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ShopMenuRowProps {
  shopMenu: ShopMenuRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (shopMenu: ShopMenuRowData) => void
  onDelete?: (shopMenu: ShopMenuRowData) => void
  onMoveUp?: (shopMenu: ShopMenuRowData) => void
  onMoveDown?: (shopMenu: ShopMenuRowData) => void
}

export default function ShopMenuRow({
  shopMenu,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ShopMenuRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{shopMenu.name}</td>
      <td className="px-4 py-2 border border-gray-200">{shopMenu.slug}</td>
      <td className="px-4 py-2 border border-gray-200">
        {canUpdate ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(shopMenu)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center">
              {shopMenu.sortOrder != null ? shopMenu.sortOrder : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(shopMenu)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{shopMenu.sortOrder != null ? shopMenu.sortOrder : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={shopMenu.isActive ? 'active' : 'inactive'}
          label={shopMenu.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">{shopMenu.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{shopMenu.updatedAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(shopMenu)}
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
                onClick={() => onDelete?.(shopMenu)}
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

