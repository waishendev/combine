'use client'

import StatusBadge from '@/components/StatusBadge'
import { useI18n } from '@/lib/i18n'

import type { BookingProductCategoryRowData } from './bookingProductCategoryUtils'

export type { BookingProductCategoryRowData }

interface BookingProductCategoryRowProps {
  category: BookingProductCategoryRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export default function BookingProductCategoryRow({
  category,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: BookingProductCategoryRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="border border-gray-200 px-4 py-2">{category.name}</td>
      <td className="border border-gray-200 px-4 py-2">
        <StatusBadge
          status={category.isActive ? 'active' : 'inactive'}
          label={category.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="border border-gray-200 px-4 py-2">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={onEdit}
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
                onClick={onDelete}
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
