'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import StaffConsumableProductModal, {
  type ConsumableProduct,
  type ConsumableVariant,
} from '@/components/staff-consumables/StaffConsumableProductModal'

type CartItem = {
  key: string
  product_id: number
  variant_id?: number | null
  name: string
  sku?: string | null
  image_url?: string | null
  category?: string | null
  original_price: number
  stock?: number | null
  track_stock?: boolean | null
  qty: number
}

type ClaimHistoryRow = {
  id: number
  claimed_at?: string | null
  staff?: string | null
  order_number?: string | null
  reference_no?: string | null
  product?: string | null
  sku?: string | null
  qty: number
  original_price: number
  final_amount: number
}

const formatCurrency = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0)
  return `RM${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`
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
  const [products, setProducts] = useState<ConsumableProduct[]>([])
  const [history, setHistory] = useState<ClaimHistoryRow[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ConsumableProduct | null>(null)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(() => {
    const seen = new Map<string, string>()
    products.forEach((product) => {
      product.categories?.forEach((cat) => {
        if (cat?.name) seen.set(String(cat.id), cat.name)
      })
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (query.trim()) params.set('q', query.trim())
      if (category !== 'all') params.set('category_id', category)
      const res = await fetch(`/api/proxy/pos/staff-consumables/products?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load consumable products.')
      setProducts(getPagedData<ConsumableProduct>(json).filter((product) => product && product.product_id))
    } catch (err) {
      setProducts([])
      setError(err instanceof Error ? err.message : 'Unable to load consumable products.')
    } finally {
      setLoading(false)
    }
  }, [category, query])

  const loadHistory = useCallback(async () => {
    if (!canViewLogs) {
      setHistory([])
      return
    }
    try {
      const res = await fetch('/api/proxy/admin/staff-consumables/logs?per_page=15', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setHistory(getPagedData<ClaimHistoryRow>(json))
    } catch {
      // History is helpful, but claims should still work when it cannot load.
    }
  }, [canViewLogs])


  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

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
    try {
      const res = await fetch('/api/proxy/pos/staff-consumables/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({ product_id: item.product_id, variant_id: item.variant_id, qty: item.qty })),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to record consumable claim.')
      setCart([])
      setMessage(`Consumable claim recorded. Order ${json?.data?.order_number ?? json?.order_number ?? ''}`.trim())
      await Promise.all([loadProducts(), loadHistory()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record consumable claim.')
    } finally {
      setCheckingOut(false)
    }
  }

  const claimCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const originalTotal = cart.reduce((sum, item) => sum + item.original_price * item.qty, 0)

  return (
    <div className="min-h-full bg-slate-100 px-3 py-4 sm:px-5 lg:px-8">
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
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
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
            <div className="grid min-h-[260px] auto-rows-max grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Claim cart</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{claimCount} item(s)</span>
            </div>
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Tap a product to add supplies to your claim.</div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.key} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">SKU: {item.sku || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">Original {formatCurrency(item.original_price)} → <span className="font-bold text-emerald-700">RM0.00</span></p>
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
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-500"><span>Original value</span><span>{formatCurrency(originalTotal)}</span></div>
              <div className="mt-1 flex justify-between text-slate-500"><span>Staff free discount</span><span>-{formatCurrency(originalTotal)}</span></div>
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-bold text-slate-900"><span>Total</span><span className="text-emerald-700">RM0.00</span></div>
            </div>
            <button
              type="button"
              onClick={checkout}
              disabled={cart.length === 0 || checkingOut || !canCheckout}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {!canCheckout ? 'No checkout permission' : checkingOut ? 'Recording claim...' : 'Checkout RM0 & Deduct Stock'}
            </button>
          </section>


          {canViewLogs ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Recent Consumable Claims</h2>
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No recent consumable claims.</p>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr>
                      <th className="py-2 pr-2">Date/time</th>
                      <th className="py-2 pr-2">Staff</th>
                      <th className="py-2 pr-2">Product</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 text-right">Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-2 text-slate-500">{row.claimed_at ?? '-'}</td>
                        <td className="py-2 pr-2 text-slate-700">{row.staff ?? '-'}</td>
                        <td className="py-2 pr-2"><span className="block font-semibold text-slate-800">{row.product ?? '-'}</span><span className="text-slate-500">{row.sku ?? '-'}</span><span className="block text-slate-500">Original {formatCurrency(row.original_price)}</span></td>
                        <td className="py-2 pr-2 text-right text-slate-700">{row.qty}</td>
                        <td className="py-2 text-right font-bold text-emerald-700">{formatCurrency(row.final_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          ) : null}
        </aside>
      </div>

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
