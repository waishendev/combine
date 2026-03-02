'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'
import type { StaffRowData } from './staffUtils'

export type { StaffRowData }

interface StaffRowProps {
  staff: StaffRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (staff: StaffRowData) => void
  onDelete?: (staff: StaffRowData) => void
}

export default function StaffRow({
  staff,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: StaffRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{staff.name}</td>
      <td className="px-4 py-2 border border-gray-200">{staff.email}</td>
      <td className="px-4 py-2 border border-gray-200">{staff.phone}</td>
      <td className="px-4 py-2 border border-gray-200">
        {(staff.commissionRate * 100).toFixed(2)}%
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={staff.isActive ? 'active' : 'inactive'}
          label={staff.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(staff)}
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
                onClick={() => onDelete?.(staff)}
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
