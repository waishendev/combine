'use client'

import { useEffect, useState } from 'react'

import { useI18n } from '@/lib/i18n'
import StatusBadge from './StatusBadge'

export interface RolePermissionData {
  id: number | string
  name: string
  slug: string
}

export interface RoleRowData {
  id: number | string
  name: string
  description: string | null
  isActive: boolean
  permissions: RolePermissionData[]
  permissionNames: string
  permissionCount: number
  createdAt: string
  updatedAt: string
}

interface RoleRowProps {
  role: RoleRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (role: RoleRowData) => void
  onDelete?: (role: RoleRowData) => void
  onViewPermissions?: (role: RoleRowData) => void
}

export default function RoleRow({
  role,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
  onViewPermissions,
}: RoleRowProps) {
  const { t } = useI18n()
  const [visiblePermissionCount, setVisiblePermissionCount] = useState(2)

  useEffect(() => {
    const calculateVisibleCount = () => {
      if (typeof window === 'undefined') return 2
      const width = window.innerWidth

      if (width >= 1536) return 5
      if (width >= 1280) return 3
      if (width >= 1024) return 3
      if (width >= 768) return 3
      return 2
    }

    const updateVisibleCount = () => {
      setVisiblePermissionCount((prev) => {
        const next = calculateVisibleCount()
        return prev === next ? prev : next
      })
    }

    updateVisibleCount()

    window.addEventListener('resize', updateVisibleCount)
    return () => window.removeEventListener('resize', updateVisibleCount)
  }, [])

  const previewNames = role.permissions
    .slice(0, visiblePermissionCount)
    .map((permission) => permission.name)
  const remaining = role.permissionCount - previewNames.length
  const displayText =
    previewNames.length > 0
      ? `${previewNames.join(', ')}${
          remaining > 0 ? ` +${remaining} ${t('role.moreSuffix')}` : ''
        }`
      : '-'

  return (
    <tr className="text-sm">
      <td className="border border-gray-200 px-4 py-2 font-medium text-gray-900">
        {role.name}
      </td>
      <td className="border border-gray-200 px-4 py-2 text-gray-700">
        {role.description || '-'}
      </td>
      <td className="border border-gray-200 px-4 py-2">
        <StatusBadge
          status={role.isActive ? 'active' : 'inactive'}
          label={role.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className="max-w-[220px] break-words text-gray-700 sm:max-w-[320px] lg:max-w-[480px] xl:max-w-[640px] 2xl:max-w-[800px]"
          >
            {displayText}
          </span>
          {role.permissionCount > 0 && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => onViewPermissions?.(role)}
              aria-label={t('role.viewPermissions')}
              title={t('role.viewPermissions')}
            >
              <i className="fa-solid fa-eye" />
            </button>
          )}
        </div>
      </td>
      {showActions && (
        <td className="border border-gray-200 px-4 py-2">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(role)}
                aria-label={t('role.editAction')}
                title={t('role.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(role)}
                aria-label={t('role.deleteAction')}
                title={t('role.deleteAction')}
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
