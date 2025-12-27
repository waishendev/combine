import type { ProductRowData } from './ProductRow'

export type ProductApiCategory = {
  id?: number | string | null
  name?: string | null
}

export type ProductApiImage = {
  id?: number | string | null
  product_id?: number | string | null
  image_path?: string | null
  is_main?: boolean | number | string | null
  sort_order?: number | string | null
}

export type ProductApiItem = {
  id: number | string
  name?: string | null
  slug?: string | null
  sku?: string | null
  type?: string | null
  description?: string | null
  price?: string | number | null
  cost_price?: string | number | null
  stock?: number | string | null
  low_stock_threshold?: number | string | null
  is_active?: boolean | number | string | null
  is_featured?: boolean | number | string | null
  is_reward_only?: boolean | number | string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  meta_og_image?: string | null
  created_at?: string | null
  updated_at?: string | null
  track_stock?: boolean | number | string | null
  categories?: ProductApiCategory[] | null
  images?: ProductApiImage[] | null
}

export const mapProductApiItemToRow = (item: ProductApiItem): ProductRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const toBoolean = (value: unknown) =>
    value === true || value === 'true' || value === 1 || value === '1'

  const priceValue =
    typeof item.price === 'number'
      ? item.price
      : typeof item.price === 'string'
        ? Number.parseFloat(item.price)
        : 0

  const costValue =
    typeof item.cost_price === 'number'
      ? item.cost_price
      : typeof item.cost_price === 'string'
        ? Number.parseFloat(item.cost_price)
        : 0

  const stockValue =
    typeof item.stock === 'number'
      ? item.stock
      : typeof item.stock === 'string'
        ? Number.parseInt(item.stock, 10)
        : 0

  const lowStockValue =
    typeof item.low_stock_threshold === 'number'
      ? item.low_stock_threshold
      : typeof item.low_stock_threshold === 'string'
        ? Number.parseInt(item.low_stock_threshold, 10)
        : 0

  return {
    id: normalizedId,
    name: item.name ?? '-',
    slug: item.slug ?? '-',
    sku: item.sku ?? '-',
    type: item.type ?? '-',
    description: item.description ?? '-',
    price: Number.isFinite(priceValue) ? priceValue : 0,
    costPrice: Number.isFinite(costValue) ? costValue : 0,
    stock: Number.isFinite(stockValue) ? stockValue : 0,
    lowStockThreshold: Number.isFinite(lowStockValue) ? lowStockValue : 0,
    isActive: toBoolean(item.is_active),
    isFeatured: toBoolean(item.is_featured),
    isRewardOnly: toBoolean(item.is_reward_only),
    metaTitle: item.meta_title ?? '-',
    metaDescription: item.meta_description ?? '-',
    metaKeywords: item.meta_keywords ?? '-',
    metaOgImage: item.meta_og_image ?? '-',
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
    categoryIds: Array.isArray(item.categories)
      ? item.categories
          .map((category) =>
            typeof category?.id === 'number'
              ? category.id
              : Number(category?.id) || Number.parseInt(String(category?.id ?? ''), 10)
          )
          .filter((id) => Number.isFinite(id) && id > 0)
      : [],
    categories: Array.isArray(item.categories)
      ? item.categories
          .map((category) => category?.name)
          .filter(Boolean)
          .join(', ')
      : '-',
    images: Array.isArray(item.images)
      ? item.images.map((image) => ({
        id: typeof image.id === 'number' ? image.id : Number(image.id) || 0,
        path: image.image_path ?? '',
        isMain: toBoolean(image.is_main),
        sortOrder:
          typeof image.sort_order === 'number'
            ? image.sort_order
            : typeof image.sort_order === 'string'
              ? Number.parseInt(image.sort_order, 10)
              : 0,
      }))
      : [],
  }
}
