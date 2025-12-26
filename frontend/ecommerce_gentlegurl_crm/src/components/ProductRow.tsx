'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface ProductImage {
  id: number
  path: string
  isMain: boolean
  sortOrder: number
}

export interface ProductRowData {
  id: number
  name: string
  slug: string
  sku: string
  type: string
  description: string
  price: number
  costPrice: number
  stock: number
  lowStockThreshold: number
  isActive: boolean
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  metaOgImage: string
  createdAt: string
  updatedAt: string
  categoryIds: number[]
  categories: string
  images: ProductImage[]
}

interface ProductRowProps {
  product: ProductRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (product: ProductRowData) => void
  onDelete?: (product: ProductRowData) => void
}

export default function ProductRow({
  product,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: ProductRowProps) {
  const { t } = useI18n()

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{product.name}</td>
      <td className="px-4 py-2 border border-gray-200">{product.sku}</td>
      <td className="px-4 py-2 border border-gray-200">{product.type}</td>
      <td className="px-4 py-2 border border-gray-200">{product.categories}</td>
      <td className="px-4 py-2 border border-gray-200">{product.price.toFixed(2)}</td>
      <td className="px-4 py-2 border border-gray-200">{product.stock}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={product.isActive ? 'active' : 'inactive'}
          label={product.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">{product.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{product.updatedAt}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(product)}
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
                onClick={() => onDelete?.(product)}
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
