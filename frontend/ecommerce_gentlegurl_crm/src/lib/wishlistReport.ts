export type TopWishlistSummary = {
  top_wishlisted_product: string | null
  top_wishlist_count: number
  top_wishlisted_product_count: number
  top_wishlisted_is_tie: boolean
}

export function topWishlistSummary(summary: TopWishlistSummary) {
  if (summary.top_wishlist_count <= 0 || summary.top_wishlisted_product_count === 0) return 'No wishlist data'
  if (summary.top_wishlisted_is_tie) {
    const noun = summary.top_wishlisted_product_count === 1 ? 'product' : 'products'
    const wishes = summary.top_wishlist_count === 1 ? 'wish' : 'wishes'
    return `Tie — ${summary.top_wishlisted_product_count} ${noun} (${summary.top_wishlist_count} ${wishes} each)`
  }
  return summary.top_wishlisted_product ?? 'No wishlist data'
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
