'use client'

import { useI18n } from '@/lib/i18n'

export interface PermissionRowData {
  id: number
  groupId: number | null
  groupName: string
  name: string
  slug: string
  description: string | null
  createdAt: string
  updatedAt: string
}

interface PermissionRowProps {
  permission: PermissionRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (permission: PermissionRowData) => void
  onDelete?: (permission: PermissionRowData) => void
}

export default function PermissionRow({
  permission,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: PermissionRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{permission.name}</td>
      <td className="px-4 py-2 border border-gray-200">{permission.slug}</td>
      <td className="px-4 py-2 border border-gray-200">
        {permission.groupName || '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {permission.description || '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">{permission.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{permission.updatedAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(permission)}
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
                onClick={() => onDelete?.(permission)}
                aria-label={t('admin.deleteAction')}
                title={t('admin.deleteAction')}
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

