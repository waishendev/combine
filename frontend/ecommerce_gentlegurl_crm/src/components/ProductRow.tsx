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
  dummySoldCount?: number
  isActive: boolean
  isFeatured: boolean
  isRewardOnly: boolean
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
  hideCategories?: boolean
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (product: ProductRowData) => void
  onDelete?: (product: ProductRowData) => void
}

export default function ProductRow({
  product,
  hideCategories = false,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: ProductRowProps) {
  const { t } = useI18n()
  const mainImage = product.images.find((image) => image.isMain) ?? product.images[0]

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex items-center gap-3">
          {mainImage?.path ? (
            <img
              src={mainImage.path}
              alt={product.name}
              className="h-10 w-10 rounded object-cover border border-gray-200 bg-gray-50"
              loading="lazy"
            />
          ) : (
            <div className="h-10 w-10 rounded border border-dashed border-gray-300 bg-gray-50" />
          )}
          <span className="text-gray-900">{product.name}</span>
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">{product.sku}</td>
      {!hideCategories && (
        <td className="px-4 py-2 border border-gray-200">{product.categories}</td>
      )}
      <td className="px-4 py-2 border border-gray-200">{product.price.toFixed(2)}</td>
      <td className="px-4 py-2 border border-gray-200">{product.stock}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={product.isActive ? 'active' : 'inactive'}
          label={product.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
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
