'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface CategoryRowData {
  id: number
  name: string
  slug: string
  description: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  metaOgImage: string
  isActive: boolean
  sortOrder: number
  menuIds: number[]
  menuNames: string
  createdAt: string
  updatedAt: string
}

interface CategoryRowProps {
  category: CategoryRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (category: CategoryRowData) => void
  onDelete?: (category: CategoryRowData) => void
}

export default function CategoryRow({
  category,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{category.name}</td>
      <td className="px-4 py-2 border border-gray-200">{category.slug}</td>
      <td className="px-4 py-2 border border-gray-200">{category.description}</td>
      <td className="px-4 py-2 border border-gray-200">{category.menuNames}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={category.isActive ? 'active' : 'inactive'}
          label={category.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">{category.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{category.updatedAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(category)}
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
                onClick={() => onDelete?.(category)}
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

