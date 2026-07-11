'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface CategoryRowData {
  id: number
  name: string
  cnName: string
  slug: string
  description: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  metaOgImage: string
  /** Absolute URL from API for image preview (`img` src). */
  metaOgImageUrl?: string
  isActive: boolean
  showInPosFilter: boolean
  sortOrder: number
  menuIds: number[]
  menuNames: string
  createdAt: string
  updatedAt: string
}

interface CategoryRowProps {
  category: CategoryRowData
  showActions?: boolean
  showSelection?: boolean
  selected?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onSelectChange?: (category: CategoryRowData, checked: boolean) => void
  onEdit?: (category: CategoryRowData) => void
  onDelete?: (category: CategoryRowData) => void
}

export default function CategoryRow({
  category,
  showActions = false,
  showSelection = false,
  selected = false,
  canUpdate = false,
  canDelete = false,
  onSelectChange,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      {showSelection && (
        <td className="border border-gray-200 px-4 py-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={selected}
            onChange={(e) => onSelectChange?.(category, e.target.checked)}
            aria-label={`Select ${category.name}`}
          />
        </td>
      )}
      <td className="px-4 py-2 border border-gray-200">
        <div>{category.name}</div>
        {category.cnName ? <div className="mt-0.5">{category.cnName}</div> : null}
      </td>
      <td className="px-4 py-2 border border-gray-200">{category.slug}</td>
      <td className="px-4 py-2 border border-gray-200">{category.description}</td>
      <td className="px-4 py-2 border border-gray-200">{category.menuNames}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={category.showInPosFilter ? 'active' : 'inactive'}
          label={category.showInPosFilter ? 'Yes' : 'No'}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={category.isActive ? 'active' : 'inactive'}
          label={category.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
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

