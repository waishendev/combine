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
  canViewPosSummary?: boolean
  onEdit?: (staff: StaffRowData) => void
  onDelete?: (staff: StaffRowData) => void
  onView?: (staff: StaffRowData) => void
  onViewPosSummary?: (staff: StaffRowData) => void
}

export default function StaffRow({
  staff,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canViewPosSummary = false,
  onEdit,
  onDelete,
  onView,
  onViewPosSummary,
}: StaffRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">
        {staff.avatarUrl ? <img src={staff.avatarUrl} alt={staff.name} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><i className="fa-solid fa-user text-gray-500" /></div>}
      </td>
      <td className="px-4 py-2 border border-gray-200">{staff.name}</td>
      <td className="px-4 py-2 border border-gray-200">{staff.email}</td>
      <td className="px-4 py-2 border border-gray-200">{staff.phone}</td>
      <td className="px-4 py-2 border border-gray-200">
        {(staff.commissionRate * 100).toFixed(2)}%
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {(staff.serviceCommissionRate * 100).toFixed(2)}%
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
            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-600 text-white hover:bg-gray-700" onClick={() => onView?.(staff)} title="View"><i className="fa-solid fa-eye" /></button>
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
            {canViewPosSummary && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded bg-indigo-600 px-3 h-8 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onViewPosSummary?.(staff)}
                disabled={!staff.adminUserId}
                aria-label="View POS Summary"
                title={staff.adminUserId ? 'View POS Summary' : 'No linked login account'}
              >
                POS
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
