import assert from 'node:assert/strict'
import test from 'node:test'

import { topWishlistCardContent, topWishlistSummary, wishlistStockDisplay } from '../../lib/wishlistReport.ts'

const summary = (count: number, products: number, tie: boolean, name: string | null = null) => ({
  total_wishlisted_products: products,
  total_wishlist_adds: count * products,
  top_wishlisted_product: name,
  top_wishlist_count: count,
  top_wishlisted_product_count: products,
  top_wishlisted_is_tie: tie,
  out_of_stock_products_with_demand: 0,
})

test('renders a unique top wishlisted product', () => {
  assert.deepEqual(topWishlistCardContent(summary(5, 1, false, 'Product A')), {
    label: 'Top Wishlisted Product',
    primary: 'Product A',
    secondary: '5 wishes',
  })
  assert.equal(topWishlistSummary(summary(5, 1, false, 'Product A')), 'Product A · 5 wishes')
})

test('renders two- and three-product ties without choosing an arbitrary product', () => {
  assert.deepEqual(topWishlistCardContent(summary(5, 2, true)), {
    label: 'Top Wishlisted Products',
    primary: '2 products',
    secondary: '5 wishes each',
    badge: 'Tied',
  })
  assert.deepEqual(topWishlistCardContent(summary(1, 3, true)), {
    label: 'Top Wishlisted Products',
    primary: '3 products',
    secondary: '1 wish each',
    badge: 'Tied',
  })
  assert.equal(topWishlistSummary(summary(1, 3, true)), 'Tied: 3 products · 1 wish each')
})

test('renders an explicit zero-data state', () => {
  assert.equal(topWishlistCardContent(summary(0, 0, false)).primary, 'No wishlist data')
  assert.equal(topWishlistSummary(summary(0, 0, false)), 'No wishlist data')
})

test('summarizes simple and aggregate variant stock without expanding report rows', () => {
  const base = { low_stock_threshold: 5, variant_count: 0, out_of_stock_variant_count: 0 }
  assert.equal(wishlistStockDisplay({ ...base, has_variants: false, stock_status: 'in_stock', current_stock: 30 }).label, 'In stock (30)')
  assert.equal(wishlistStockDisplay({ ...base, has_variants: false, stock_status: 'out_of_stock', current_stock: 0 }).label, 'Out of stock')
  assert.equal(wishlistStockDisplay({ ...base, has_variants: true, stock_status: 'in_stock', current_stock: null, variant_count: 3 }).label, 'In stock')
  assert.equal(wishlistStockDisplay({ ...base, has_variants: true, stock_status: 'partial', current_stock: null, variant_count: 3, out_of_stock_variant_count: 1 }).label, 'Some variants out of stock (1/3)')
  assert.equal(wishlistStockDisplay({ ...base, has_variants: true, stock_status: 'out_of_stock', current_stock: null, variant_count: 3, out_of_stock_variant_count: 3 }).label, 'Out of stock')
})
