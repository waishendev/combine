'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import StaffConsumableProductModal, {
  type ConsumableProduct,
  type ConsumableVariant,
} from '@/components/staff-consumables/StaffConsumableProductModal'
import { NameStack, VariantNameStack } from '@/components/NameStack'
import { useBranch } from '@/contexts/BranchContext'
import { usePosWideLayout } from '@/lib/usePosWideLayout'

type CartItem = {
  key: string
  product_id: number
  variant_id?: number | null
  name: string
  product_name: string
  product_cn_name?: string | null
  variant_name?: string | null
  variant_cn_name?: string | null
  sku?: string | null
  image_url?: string | null
  category?: string | null
  original_price: number
  stock?: number | null
  track_stock?: boolean | null
  qty: number
}

const getPagedData = <T,>(json: unknown): T[] => {
  if (!json || typeof json !== 'object') return []
  const root = json as { data?: unknown }
  const data = root.data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data
  }
  return []
}

export default function StaffConsumablesPageContent({ canCheckout, canViewLogs }: { canCheckout: boolean; canViewLogs: boolean }) {
  const { accessibleBranches, selectedBranchId, isAllBranches, loading: branchesLoading } = useBranch()
  const { isCompactLayout } = usePosWideLayout()
  const [products, setProducts] = useState<ConsumableProduct[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ConsumableProduct | null>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [cartBarPulse, setCartBarPulse] = useState(false)
  void canViewLogs

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    products.forEach((product) => {
      product.categories?.forEach((cat) => {
        if (cat?.name) seen.set(String(cat.id), cat.name)
      })
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const claimCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const hasCartItems = cart.length > 0

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (query.trim()) params.set('q', query.trim())
      if (category !== 'all') params.set('category_id', category)
      if (!selectedBranchId) {
        setProducts([])
        return
      }
      params.set('store_location_id', String(selectedBranchId))
      const res = await fetch(`/api/proxy/admin/staff-consumables/catalog?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load consumable products.')
      setProducts(getPagedData<ConsumableProduct>(json).filter((product) => product && product.product_id))
    } catch (err) {
      setProducts([])
      setError(err instanceof Error ? err.message : 'Unable to load consumable products.')
    } finally {
      setLoading(false)
    }
  }, [category, query, selectedBranchId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  useEffect(() => {
    if (!cartSheetOpen || typeof document === 'undefined') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [cartSheetOpen])

  useEffect(() => {
    if (!hasCartItems && cartSheetOpen) setCartSheetOpen(false)
  }, [hasCartItems, cartSheetOpen])

  useEffect(() => {
    if (isCompactLayout !== true && cartSheetOpen) setCartSheetOpen(false)
  }, [isCompactLayout, cartSheetOpen])

  const pulseCartBar = () => {
    setCartBarPulse(true)
    window.setTimeout(() => setCartBarPulse(false), 550)
  }

  const openProductModal = (product: ConsumableProduct) => {
    setMessage(null)
    setError(null)
    setSelectedProduct(product)
    setProductModalOpen(true)
  }

  const addProduct = (product: ConsumableProduct, variant: ConsumableVariant | null, qty = 1) => {
    setMessage(null)
    setError(null)
    const key = variant ? `v-${variant.id}` : `p-${product.product_id}`
    const stock = variant ? variant.stock : product.stock
    const trackStock = variant ? variant.track_stock : product.track_stock
    const addQty = Math.max(1, Math.floor(qty || 1))
    setCart((current) => {
      const existing = current.find((item) => item.key === key)
      if (existing) {
        const nextQty = existing.qty + addQty
        const cappedQty = typeof stock === 'number' ? Math.min(nextQty, stock) : nextQty
        if (cappedQty <= existing.qty) return current
        return current.map((item) => (item.key === key ? { ...item, qty: cappedQty } : item))
      }
      const initialQty = typeof stock === 'number' ? Math.min(addQty, stock) : addQty
      if (initialQty < 1) return current
      return [
        ...current,
        {
          key,
          product_id: product.product_id,
          variant_id: variant?.id ?? null,
          name: variant ? `${product.name} - ${variant.name}` : product.name,
          product_name: product.name,
          product_cn_name: product.cn_name,
          variant_name: variant?.name ?? null,
          variant_cn_name: variant?.cn_name ?? null,
          sku: variant?.sku ?? product.sku,
          image_url: variant?.image_url ?? product.image_url ?? product.thumbnail_url,
          category: product.category ?? product.categories?.[0]?.name ?? null,
          original_price: Number(variant?.price ?? product.price ?? 0),
          stock,
          track_stock: trackStock,
          qty: initialQty,
        },
      ]
    })
    if (isCompactLayout === true) pulseCartBar()
  }

  const isProductOutOfStock = (product: ConsumableProduct) => {
    const variants = product.variants ?? []
    if (variants.length > 0) {
      return variants.every((variant) => variant.track_stock === true && typeof variant.stock === 'number' && variant.stock <= 0)
    }
    return product.track_stock === true && typeof product.stock === 'number' && product.stock <= 0
  }

  const updateQty = (key: string, qty: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.key !== key) return item
          const nextQty = Math.max(1, Math.floor(qty || 1))
          const cappedQty = typeof item.stock === 'number' ? Math.min(nextQty, item.stock) : nextQty
          return { ...item, qty: cappedQty }
        })
        .filter((item) => item.qty > 0),
    )
  }

  const checkout = async () => {
    if (cart.length === 0 || checkingOut || !canCheckout) return
    setCheckingOut(true)
    setError(null)
    setMessage(null)
    if (!selectedBranchId) {
      setError(accessibleBranches.length === 0 ? 'No active branches.' : 'Select a Branch before purchasing consumables.')
      setCheckingOut(false)
      return
    }
    try {
      const res = await fetch('/api/proxy/admin/staff-consumables/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_location_id: selectedBranchId,
          items: cart.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id, qty: item.qty })),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to record consumable claim.')
      setCart([])
      setCartSheetOpen(false)
      setMessage(`Consumable claim recorded. Order ${json?.data?.order_number ?? json?.order_number ?? ''}`.trim())
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record consumable claim.')
    } finally {
      setCheckingOut(false)
    }
  }

  const branchBlocked = !branchesLoading && (isAllBranches || !selectedBranchId)

  return (
    <div className="pos-checkout-workspace min-h-0">
      <div className="pos-checkout-page-header mb-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Staff supplies</p>
            <h1 className="text-2xl font-bold text-slate-900">Staff Consumables</h1>
            <p className="mt-1 text-sm text-slate-500">
              Pick service supplies your team uses on the floor. Tap a product to choose variant and quantity, then claim at RM0.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            STAFF FREE APPLIED · Total RM0
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`mb-3 rounded-xl border px-4 py-3 text-sm sm:mb-4 ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      {!branchesLoading && accessibleBranches.length === 0 ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:mb-4">No active branches. Consumable purchasing is unavailable.</div>
      ) : null}

      {branchBlocked ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950">
          <h2 className="font-semibold">Select a specific Branch to use Staff Consumables</h2>
          <p className="mt-2 text-sm">All Branches is for reporting and configuration only. Consumable claims cannot operate across Branches.</p>
        </div>
      ) : (
        <div
          className={[
            'pos-split-layout grid min-w-0 gap-3 sm:gap-4 lg:gap-5',
            isCompactLayout === true ? 'flex min-h-0 flex-col' : 'min-h-0 flex-1',
          ].join(' ')}
        >
          <div
            className={[
              'pos-split-catalog min-w-0 flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 lg:gap-5',
              isCompactLayout === true && hasCartItems && 'pos-split-catalog--floating-bar',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <section className="@container pos-split-panel flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-4 shadow-md sm:p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, SKU or barcode"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === cat.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Loading staff-free consumables...</div>
              ) : products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No staff-free consumable products found.</div>
              ) : (
                <div className="pos-split-product-grid grid min-h-[260px] auto-rows-max grid-cols-1 gap-3 sm:grid-cols-2">
                  {products.map((product) => {
                    const variantsCount = product.variants?.length ?? product.variants_count ?? 0
                    const outOfStock = isProductOutOfStock(product)
                    const imageUrl = product.thumbnail_url ?? product.image_url
                    return (
                      <div
                        key={product.product_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openProductModal(product)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openProductModal(product)
                          }
                        }}
                        className={`group flex h-[124px] cursor-pointer flex-row overflow-hidden rounded-xl border-2 bg-white shadow-sm transition hover:shadow-lg ${
                          outOfStock ? 'border-red-100 opacity-90' : 'border-slate-200 hover:border-emerald-400'
                        }`}
                      >
                        <div className="h-full w-[120px] shrink-0 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <i className="fa-solid fa-box text-2xl" />
                            </div>
                          )}
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between p-4">
                          <div className="min-w-0">
                            <p className="mb-1 line-clamp-2 text-sm font-bold leading-tight text-slate-900">{product.name}</p>
                            {product.cn_name?.trim() ? (
                              <p className="mb-1 line-clamp-1 text-xs text-slate-500">{product.cn_name}</p>
                            ) : null}
                            <p className="truncate font-mono text-xs text-slate-500">{product.sku || '—'}</p>
                            {variantsCount > 0 ? (
                              <p className="mt-0.5 text-[11px] font-medium text-emerald-700">({variantsCount} variants)</p>
                            ) : null}
                            {outOfStock ? (
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-red-600">Out of stock</p>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Tap to add</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <div
            className={[
              'pos-split-cart min-w-0 flex min-h-0 flex-col overflow-hidden',
              isCompactLayout === true && 'fixed inset-x-0 bottom-0 z-[130] max-h-[92dvh] transition-transform duration-300 ease-out',
              isCompactLayout === true &&
                (cartSheetOpen
                  ? 'translate-y-0 pointer-events-auto visible pos-cart-sheet-open'
                  : 'translate-y-full pointer-events-none invisible'),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isCompactLayout === true && cartSheetOpen ? (
              <button
                type="button"
                className="pos-cart-sheet-backdrop-scrim fixed inset-x-0 top-0 z-0 touch-manipulation bg-slate-900/45 backdrop-blur-[2px]"
                aria-label="Close cart"
                onClick={() => setCartSheetOpen(false)}
              />
            ) : null}

            <div
              className={[
                'pos-split-panel pos-split-cart-panel relative z-[1] flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-4 shadow-md sm:p-5',
                isCompactLayout === true &&
                  'max-h-[92dvh] min-h-0 rounded-b-none rounded-t-2xl border-b-0 shadow-[0_-12px_40px_rgba(15,23,42,0.18)]',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="pos-cart-sheet-handle" aria-hidden="true" />
              <div className="pos-split-cart-header mb-0 flex shrink-0 items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">CART</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{claimCount} item(s)</span>
                <button
                  type="button"
                  aria-label="Close cart"
                  onClick={() => setCartSheetOpen(false)}
                  className="pos-cart-sheet-close ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="pos-split-cart-scroll mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                {cart.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Tap a product to add supplies to your claim.</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.key} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <NameStack
                            name={item.product_name}
                            cnName={item.product_cn_name}
                            primaryClassName="truncate text-sm font-semibold text-slate-900"
                            secondaryClassName="truncate text-xs text-slate-500"
                          />
                          {item.variant_name?.trim() || item.variant_cn_name?.trim() ? (
                            <div className="mt-0.5">
                              <VariantNameStack
                                name={item.variant_name}
                                cnName={item.variant_cn_name}
                                nameClassName="truncate text-xs text-slate-700"
                                labelClassName="text-xs text-slate-500"
                                cnClassName="truncate text-xs text-slate-500"
                              />
                            </div>
                          ) : null}
                          <p className="truncate text-xs text-slate-500">SKU: {item.sku || '-'}</p>
                          <p className="mt-1 text-xs font-bold text-emerald-700">RM 0.00</p>
                        </div>
                        <button type="button" onClick={() => setCart((current) => current.filter((row) => row.key !== item.key))} className="text-slate-400 hover:text-red-500">
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Stock: {item.track_stock ? item.stock ?? 0 : 'Not tracked'}</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateQty(item.key, item.qty - 1)} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600">−</button>
                          <input value={item.qty} onChange={(event) => updateQty(item.key, Number(event.target.value))} className="h-8 w-14 rounded-lg border border-slate-200 text-center text-sm" />
                          <button type="button" onClick={() => updateQty(item.key, item.qty + 1)} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600">+</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pos-split-cart-footer shrink-0">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between text-lg font-bold text-slate-900"><span>Total</span><span className="text-emerald-700">RM 0.00</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => void checkout()}
                  disabled={cart.length === 0 || checkingOut || !canCheckout || !selectedBranchId}
                  className="mt-3 h-12 w-full rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-14"
                >
                  {!canCheckout ? 'No checkout permission' : checkingOut ? 'Recording claim...' : 'Checkout RM0 & Deduct Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCompactLayout === true &&
        hasCartItems &&
        !branchBlocked &&
        typeof document !== 'undefined' &&
        createPortal(
          !cartSheetOpen ? (
            <button
              type="button"
              aria-label="View cart details and checkout"
              aria-expanded={cartSheetOpen}
              onClick={() => setCartSheetOpen(true)}
              className={[
                'pos-floating-cart-bar touch-manipulation',
                cartBarPulse ? 'pos-floating-cart-bar--pulse' : '',
                productModalOpen ? 'pos-floating-cart-bar--hidden' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="pos-floating-cart-bar-leading flex min-w-0 items-center gap-3">
                <span className="pos-floating-cart-badge">{claimCount}</span>
                <span className="flex min-w-0 flex-col items-start text-left">
                  <span className="pos-floating-cart-bar-subtitle text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    {claimCount === 1 ? '1 item in cart' : `${claimCount} items in cart`}
                  </span>
                  <span className="pos-floating-cart-bar-title text-sm font-bold text-gray-900">Claim Cart</span>
                </span>
              </span>
              <span className="pos-floating-cart-bar-trailing flex shrink-0 flex-col items-end gap-1.5 text-right">
                <span>
                  <span className="pos-floating-cart-bar-total-label block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total</span>
                  <span className="pos-floating-cart-bar-total-value text-lg font-extrabold tabular-nums text-emerald-700">RM 0.00</span>
                </span>
                <span className="pos-floating-cart-bar-action inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  View Cart
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </span>
            </button>
          ) : null,
          document.body,
        )}

      <StaffConsumableProductModal
        product={selectedProduct}
        open={productModalOpen}
        onClose={() => {
          setProductModalOpen(false)
          setSelectedProduct(null)
        }}
        onAdd={addProduct}
      />
    </div>
  )
}
