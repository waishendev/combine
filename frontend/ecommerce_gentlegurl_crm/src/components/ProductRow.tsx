'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface ProductImage {
  id: number
  url: string
  isMain: boolean
  sortOrder: number
  sizeBytes?: number
}

export interface ProductVideo {
  id: number
  url: string
  thumbnailUrl?: string
  status?: string
  sizeBytes?: number
  durationSeconds?: number
  width?: number
  height?: number
}

export interface ProductVariant {
  id: number
  name: string
  sku: string
  price?: number | null
  salePrice?: number | null
  salePriceStartAt?: string | null
  salePriceEndAt?: string | null
  costPrice?: number | null
  stock?: number | null
  lowStockThreshold?: number | null
  trackStock?: boolean
  isActive?: boolean
  sortOrder?: number
  imageUrl?: string | null
  isBundle?: boolean
  derivedAvailableQty?: number | null
  bundleItems?: Array<{
    componentVariantId: number
    componentVariantName?: string | null
    componentVariantSku?: string | null
    quantity: number
    sortOrder?: number | null
  }>
}

export interface ProductRowData {
  id: number
  name: string
  slug: string
  sku: string
  type: string
  description: string
  price: number
  salePrice?: number | null
  salePriceStartAt?: string | null
  salePriceEndAt?: string | null
  minVariantPrice?: number | null
  maxVariantPrice?: number | null
  variantsCount?: number
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
  video?: ProductVideo | null
  variants?: ProductVariant[]
}

interface ProductRowProps {
  product: ProductRowData
  hideCategories?: boolean
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  showSelection?: boolean
  isSelected?: boolean
  onToggleSelect?: (product: ProductRowData, selected: boolean) => void
  onEdit?: (product: ProductRowData) => void
  onDelete?: (product: ProductRowData) => void
}

export default function ProductRow({
  product,
  hideCategories = false,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  showSelection = false,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
}: ProductRowProps) {
  const { t } = useI18n()
  const mainImage = product.images.find((image) => image.isMain) ?? product.images[0]
  const formatAmount = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  const renderPrice = () => {
    if (product.type === 'variant') {
      const minPrice = product.minVariantPrice
      const maxPrice = product.maxVariantPrice
      if (typeof minPrice !== 'number' || typeof maxPrice !== 'number') {
        return '—'
      }
      if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
        return '—'
      }
      if (minPrice === maxPrice) {
        return `RM ${formatAmount(minPrice)}`
      }
      return `RM ${formatAmount(minPrice)} - ${formatAmount(maxPrice)}`
    }

    return `RM ${formatAmount(product.price)}`
  }

  return (
    <tr className="text-sm">
      {showSelection && (
        <td className="px-4 py-2 border border-gray-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
            checked={isSelected}
            onChange={(event) => onToggleSelect?.(product, event.target.checked)}
            aria-label={`Select ${product.name}`}
          />
        </td>
      )}
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex items-center gap-3">
          {mainImage?.url ? (
            <img
              src={mainImage.url}
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
      <td className="px-4 py-2 border border-gray-200">{renderPrice()}</td>
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
