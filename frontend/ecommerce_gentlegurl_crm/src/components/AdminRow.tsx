'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface AdminRowData {
  id: number
  username: string
  email: string
  isActive: boolean
  roleName: string
  roleId: number | null
  createdAt: string
  updatedAt: string
}

interface AdminRowProps {
  admin: AdminRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isSelf?: boolean
  onEdit?: (admin: AdminRowData) => void
  onDelete?: (admin: AdminRowData) => void
}

export default function AdminRow({
  admin,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  isSelf = false,
  onEdit,
  onDelete,
}: AdminRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{admin.username}</td>
      <td className="px-4 py-2 border border-gray-200">{admin.email}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={admin.isActive ? 'active' : 'inactive'}
          label={admin.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {admin.roleName || '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">{admin.createdAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(admin)}
                aria-label={t('admin.editAction')}
                title={t('admin.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(admin)}
                aria-label={
                  isSelf ? t('admin.cannotDeleteSelf') : t('admin.deleteAction')
                }
                title={isSelf ? t('admin.cannotDeleteSelf') : t('admin.deleteAction')}
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
