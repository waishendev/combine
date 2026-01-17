import type { ProductRowData } from './ProductRow'

export type ProductApiCategory = {
  id?: number | string | null
  name?: string | null
}

export type ProductApiImage = {
  id?: number | string | null
  product_id?: number | string | null
  url?: string | null
  image_path?: string | null
  thumbnail_url?: string | null
  sort_order?: number | string | null
  status?: string | null
  size_bytes?: number | string | null
  width?: number | string | null
  height?: number | string | null
  duration_seconds?: number | string | null
}

export type ProductApiVideo = {
  id?: number | string | null
  url?: string | null
  thumbnail_url?: string | null
  status?: string | null
  size_bytes?: number | string | null
  width?: number | string | null
  height?: number | string | null
  duration_seconds?: number | string | null
}

export type ProductApiItem = {
  id: number | string
  name?: string | null
  slug?: string | null
  sku?: string | null
  type?: string | null
  description?: string | null
  price?: string | number | null
  sale_price?: string | number | null
  sale_price_start_at?: string | null
  sale_price_end_at?: string | null
  min_variant_price?: string | number | null
  max_variant_price?: string | number | null
  variants_count?: number | string | null
  cost_price?: string | number | null
  stock?: number | string | null
  low_stock_threshold?: number | string | null
  dummy_sold_count?: number | string | null
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
  video?: ProductApiVideo | null
  variants?: Array<{
    id?: number | string | null
    name?: string | null
    title?: string | null
    sku?: string | null
    price?: string | number | null
    sale_price?: string | number | null
    sale_price_start_at?: string | null
    sale_price_end_at?: string | null
    cost_price?: string | number | null
    stock?: number | string | null
    low_stock_threshold?: number | string | null
    track_stock?: boolean | number | string | null
    is_active?: boolean | number | string | null
    sort_order?: number | string | null
    image_url?: string | null
  }> | null
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

  const minVariantValue =
    typeof item.min_variant_price === 'number'
      ? item.min_variant_price
      : typeof item.min_variant_price === 'string'
        ? Number.parseFloat(item.min_variant_price)
        : null

  const maxVariantValue =
    typeof item.max_variant_price === 'number'
      ? item.max_variant_price
      : typeof item.max_variant_price === 'string'
        ? Number.parseFloat(item.max_variant_price)
        : null

  const variantsCountValue =
    typeof item.variants_count === 'number'
      ? item.variants_count
      : typeof item.variants_count === 'string'
        ? Number.parseInt(item.variants_count, 10)
        : undefined

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

  const dummySoldCountValue =
    typeof item.dummy_sold_count === 'number'
      ? item.dummy_sold_count
      : typeof item.dummy_sold_count === 'string'
        ? Number.parseInt(item.dummy_sold_count, 10)
        : undefined

  const normalizedVariants = Array.isArray(item.variants)
    ? item.variants.map((variant) => ({
      id:
        typeof variant.id === 'number'
          ? variant.id
          : Number(variant.id) || 0,
      name: variant.title ?? variant.name ?? '',
      sku: variant.sku ?? '',
      price:
        typeof variant.price === 'number'
          ? variant.price
          : typeof variant.price === 'string'
            ? Number.parseFloat(variant.price)
            : null,
      salePrice:
        (() => {
          const saleValue =
            typeof variant.sale_price === 'number'
              ? variant.sale_price
              : typeof variant.sale_price === 'string'
                ? Number.parseFloat(variant.sale_price)
                : NaN
          return Number.isFinite(saleValue) ? saleValue : null
        })(),
      salePriceStartAt: variant.sale_price_start_at ?? null,
      salePriceEndAt: variant.sale_price_end_at ?? null,
      costPrice:
        typeof variant.cost_price === 'number'
          ? variant.cost_price
          : typeof variant.cost_price === 'string'
            ? Number.parseFloat(variant.cost_price)
            : null,
      stock:
        typeof variant.stock === 'number'
          ? variant.stock
          : typeof variant.stock === 'string'
            ? Number.parseInt(variant.stock, 10)
            : null,
      lowStockThreshold:
        typeof variant.low_stock_threshold === 'number'
          ? variant.low_stock_threshold
          : typeof variant.low_stock_threshold === 'string'
            ? Number.parseInt(variant.low_stock_threshold, 10)
            : null,
      trackStock: toBoolean(variant.track_stock),
      isActive: toBoolean(variant.is_active),
      sortOrder:
        typeof variant.sort_order === 'number'
          ? variant.sort_order
          : typeof variant.sort_order === 'string'
            ? Number.parseInt(variant.sort_order, 10)
            : 0,
      imageUrl: variant.image_url ?? null,
    }))
    : []

  const variantPriceValues = normalizedVariants
    .map((variant) => variant.price)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const derivedMinPrice = variantPriceValues.length > 0 ? Math.min(...variantPriceValues) : null
  const derivedMaxPrice = variantPriceValues.length > 0 ? Math.max(...variantPriceValues) : null

  return {
    id: normalizedId,
    name: item.name ?? '-',
    slug: item.slug ?? '-',
    sku: item.sku ?? '-',
    type: item.type ?? '-',
    description: item.description ?? '-',
    price: Number.isFinite(priceValue) ? priceValue : 0,
    salePrice: (() => {
      const saleValue =
        typeof item.sale_price === 'number'
          ? item.sale_price
          : typeof item.sale_price === 'string'
            ? Number.parseFloat(item.sale_price)
            : NaN
      return Number.isFinite(saleValue) ? saleValue : null
    })(),
    salePriceStartAt: item.sale_price_start_at ?? null,
    salePriceEndAt: item.sale_price_end_at ?? null,
    minVariantPrice: Number.isFinite(minVariantValue ?? NaN) ? minVariantValue : derivedMinPrice,
    maxVariantPrice: Number.isFinite(maxVariantValue ?? NaN) ? maxVariantValue : derivedMaxPrice,
    variantsCount: Number.isFinite(variantsCountValue ?? NaN) ? variantsCountValue : normalizedVariants.length,
    costPrice: Number.isFinite(costValue) ? costValue : 0,
    stock: Number.isFinite(stockValue) ? stockValue : 0,
    lowStockThreshold: Number.isFinite(lowStockValue) ? lowStockValue : 0,
    dummySoldCount: Number.isFinite(dummySoldCountValue) ? dummySoldCountValue : undefined,
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
        url: image.url ?? image.image_path ?? '',
        isMain: typeof image.sort_order === 'number'
          ? image.sort_order === 0
          : typeof image.sort_order === 'string'
            ? Number.parseInt(image.sort_order, 10) === 0
            : false,
        sortOrder:
          typeof image.sort_order === 'number'
            ? image.sort_order
            : typeof image.sort_order === 'string'
              ? Number.parseInt(image.sort_order, 10)
              : 0,
        sizeBytes:
          typeof image.size_bytes === 'number'
            ? image.size_bytes
            : typeof image.size_bytes === 'string'
              ? Number.parseInt(image.size_bytes, 10)
              : undefined,
      }))
      : [],
    video: item.video
      ? {
          id:
            typeof item.video.id === 'number'
              ? item.video.id
              : Number(item.video.id) || 0,
          url: item.video.url ?? '',
          thumbnailUrl: item.video.thumbnail_url ?? '',
          status: item.video.status ?? undefined,
          sizeBytes:
            typeof item.video.size_bytes === 'number'
              ? item.video.size_bytes
              : typeof item.video.size_bytes === 'string'
                ? Number.parseInt(item.video.size_bytes, 10)
                : undefined,
          durationSeconds:
            typeof item.video.duration_seconds === 'number'
              ? item.video.duration_seconds
              : typeof item.video.duration_seconds === 'string'
                ? Number.parseFloat(item.video.duration_seconds)
                : undefined,
          width:
            typeof item.video.width === 'number'
              ? item.video.width
              : typeof item.video.width === 'string'
                ? Number.parseInt(item.video.width, 10)
                : undefined,
          height:
            typeof item.video.height === 'number'
              ? item.video.height
              : typeof item.video.height === 'string'
                ? Number.parseInt(item.video.height, 10)
                : undefined,
        }
      : null,
    variants: normalizedVariants,
  }
}
