export type TopWishlistSummary = {
  top_wishlisted_product: string | null
  top_wishlist_count: number
  top_wishlisted_product_count: number
  top_wishlisted_is_tie: boolean
}

export type TopWishlistCardContent = {
  label: string
  primary: string
  secondary?: string
  badge?: string
}

export function topWishlistCardContent(summary: TopWishlistSummary): TopWishlistCardContent {
  if (summary.top_wishlist_count <= 0 || summary.top_wishlisted_product_count === 0) {
    return { label: 'Top Wishlisted Product', primary: 'No wishlist data' }
  }

  const wishLabel = summary.top_wishlist_count === 1 ? '1 wish' : `${summary.top_wishlist_count} wishes`

  if (summary.top_wishlisted_is_tie) {
    const productLabel =
      summary.top_wishlisted_product_count === 1
        ? '1 product'
        : `${summary.top_wishlisted_product_count} products`

    return {
      label: 'Top Wishlisted Products',
      primary: productLabel,
      secondary: `${wishLabel} each`,
      badge: 'Tied',
    }
  }

  return {
    label: 'Top Wishlisted Product',
    primary: summary.top_wishlisted_product ?? 'No wishlist data',
    secondary: wishLabel,
  }
}

/** Compact string form (tests / plain-text). Prefer topWishlistCardContent for UI. */
export function topWishlistSummary(summary: TopWishlistSummary) {
  const card = topWishlistCardContent(summary)
  if (!card.secondary && !card.badge) return card.primary
  if (card.badge) return `${card.badge}: ${card.primary} · ${card.secondary}`
  return `${card.primary} · ${card.secondary}`
}

export type StockSummary = {
  stock_status: 'in_stock' | 'partial' | 'out_of_stock'
  has_variants: boolean
  variant_count: number
  out_of_stock_variant_count: number
  current_stock: number | null
  low_stock_threshold?: number | null
}

export function wishlistStockDisplay(row: StockSummary): { label: string; tone: 'slate' | 'rose' | 'amber' | 'emerald' } {
  if (row.stock_status === 'partial') return { label: `Some variants out of stock (${row.out_of_stock_variant_count}/${row.variant_count})`, tone: 'amber' }
  if (row.has_variants) return row.stock_status === 'out_of_stock' ? { label: 'Out of stock', tone: 'rose' } : { label: 'In stock', tone: 'emerald' }
  if (row.current_stock === null) return { label: 'Unknown', tone: 'slate' }
  if (row.current_stock <= 0) return { label: 'Out of stock', tone: 'rose' }
  const threshold = row.low_stock_threshold && row.low_stock_threshold > 0 ? row.low_stock_threshold : 5
  return row.current_stock <= threshold
    ? { label: `Low stock (${row.current_stock})`, tone: 'amber' }
    : { label: `In stock (${row.current_stock})`, tone: 'emerald' }
}
