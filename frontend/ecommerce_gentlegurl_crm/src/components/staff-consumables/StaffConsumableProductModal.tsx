'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'

export type ConsumableVariant = {
  id: number
  name: string
  cn_name?: string | null
  sku?: string | null
  price: number
  image_url?: string | null
  stock?: number | null
  track_stock?: boolean | null
  is_active?: boolean | null
}

export type ConsumableProduct = {
  id: number
  product_id: number
  name: string
  cn_name?: string | null
  sku?: string | null
  price: number
  image_url?: string | null
  thumbnail_url?: string | null
  category?: string | null
  categories?: Array<{ id: number; name: string }>
  stock?: number | null
  track_stock?: boolean | null
  variants: ConsumableVariant[]
  variants_count?: number
}

type StaffConsumableProductModalProps = {
  product: ConsumableProduct | null
  open: boolean
  onClose: () => void
  onAdd: (product: ConsumableProduct, variant: ConsumableVariant | null, qty: number) => void
}

const getImageUrl = (product: ConsumableProduct, variant?: ConsumableVariant | null) =>
  variant?.image_url ?? product.image_url ?? product.thumbnail_url ?? null

const isVariantOutOfStock = (variant: ConsumableVariant) =>
  variant.track_stock === true && typeof variant.stock === 'number' && variant.stock <= 0

const isSimpleProductOutOfStock = (product: ConsumableProduct) =>
  product.track_stock === true &&
  typeof product.stock === 'number' &&
  product.stock <= 0 &&
  (product.variants?.length ?? 0) === 0

export default function StaffConsumableProductModal({
  product,
  open,
  onClose,
  onAdd,
}: StaffConsumableProductModalProps) {
  const [variants, setVariants] = useState<ConsumableVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [qty, setQty] = useState(1)

  const hydrateVariants = useCallback(async (item: ConsumableProduct) => {
    const fromList = item.variants ?? []
    if (fromList.length > 0) {
      setVariants(fromList)
      return
    }

    const productId = Number(item.product_id)
    if (!Number.isFinite(productId) || productId <= 0) {
      setVariants([])
      return
    }

    setLoadingVariants(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${productId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setVariants([])
        return
      }
      const payload = json?.data?.product ?? json?.data ?? json?.product
      const rawVariants = Array.isArray(payload?.variants) ? payload.variants : []
      const mapped: ConsumableVariant[] = rawVariants
        .map((variant: Record<string, unknown>) => {
          const id = Number(variant.id)
          if (!Number.isFinite(id) || id <= 0) return null
          return {
            id,
            name: String(variant.name ?? variant.title ?? variant.sku ?? 'Variant'),
            cn_name: typeof variant.cn_name === 'string' ? variant.cn_name : null,
            sku: typeof variant.sku === 'string' ? variant.sku : null,
            price: Number(variant.price ?? variant.sale_price ?? item.price ?? 0),
            image_url:
              (typeof variant.image_url === 'string' && variant.image_url) ||
              (typeof variant.thumbnail_url === 'string' && variant.thumbnail_url) ||
              null,
            stock: variant.stock != null ? Number(variant.stock) : null,
            track_stock:
              variant.track_stock === false || variant.track_stock === 0 || variant.track_stock === '0'
                ? false
                : variant.track_stock != null,
            is_active: variant.is_active !== false && variant.is_active !== 0 && variant.is_active !== '0',
          }
        })
        .filter((row: ConsumableVariant | null): row is ConsumableVariant => row != null)
      setVariants(mapped)
    } catch {
      setVariants([])
    } finally {
      setLoadingVariants(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !product) return
    setQty(1)
    setSelectedVariantId(null)
    setVariants(product.variants ?? [])
    void hydrateVariants(product)
  }, [open, product, hydrateVariants])

  useEffect(() => {
    if (!open || variants.length === 0) return
    setSelectedVariantId((current) => {
      if (current && variants.some((variant) => variant.id === current)) return current
      const firstAvailable = variants.find((variant) => variant.is_active !== false && !isVariantOutOfStock(variant))
      return firstAvailable?.id ?? variants[0]?.id ?? null
    })
  }, [open, variants])

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  )

  const displayImage = product ? getImageUrl(product, selectedVariant) : null

  const stockMeta = useMemo(() => {
    if (!product) return { trackStock: false as boolean | null, stock: null as number | null }
    if (variants.length > 0 && selectedVariant) {
      return { trackStock: selectedVariant.track_stock ?? null, stock: selectedVariant.stock ?? null }
    }
    return { trackStock: product.track_stock ?? null, stock: product.stock ?? null }
  }, [product, variants.length, selectedVariant])

  const maxQty = useMemo(() => {
    if (stockMeta.trackStock !== true || typeof stockMeta.stock !== 'number') return null
    return Math.max(0, stockMeta.stock)
  }, [stockMeta])

  const clampQty = (next: number) => {
    const normalized = Math.max(1, Math.floor(next || 1))
    if (typeof maxQty === 'number') return Math.min(maxQty, normalized)
    return normalized
  }

  const outOfStock = product
    ? variants.length > 0
      ? selectedVariant
        ? isVariantOutOfStock(selectedVariant)
        : false
      : isSimpleProductOutOfStock(product)
    : false

  const canAdd =
    Boolean(product) &&
    !outOfStock &&
    !loadingVariants &&
    (variants.length === 0 || selectedVariantId != null)

  if (!open || !product) return null

  const handleAdd = () => {
    if (!canAdd) return
    onAdd(product, selectedVariant, clampQty(qty))
    onClose()
  }

  return (
    <CrmFormModalShell
      title={
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Staff consumable</p>
          <span>Add to claim</span>
        </div>
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={handleAdd}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-emerald-700 hover:to-emerald-800 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400"
          >
            Add to claim
          </button>
        </>
      }
    >
      <div className="grid gap-6 p-5 md:grid-cols-2">
          <div>
            {displayImage ? (
              <div className="aspect-square overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayImage} alt={product.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-300">
                <i className="fa-solid fa-box text-4xl" />
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-4">
            <div>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Staff free · RM0
              </span>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">{product.name}</h1>
              {product.cn_name?.trim() ? (
                <p className="mt-0.5 text-sm text-gray-500">{product.cn_name}</p>
              ) : null}
              <p className="mt-1 font-mono text-sm text-gray-500">{selectedVariant?.sku ?? product.sku ?? '—'}</p>
              {product.category || product.categories?.[0]?.name ? (
                <p className="mt-1 text-sm text-gray-500">{product.category ?? product.categories?.[0]?.name}</p>
              ) : null}
            </div>

            {loadingVariants ? (
              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Loading variants…
              </div>
            ) : variants.length > 0 ? (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900">Select variant</label>
                <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                  {variants.map((variant) => {
                    const selected = variant.id === selectedVariantId
                    const disabled = variant.is_active === false || isVariantOutOfStock(variant)
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`rounded-xl border-2 p-3 text-left transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                            : disabled
                              ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                              : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{variant.name || variant.sku}</p>
                        {variant.cn_name?.trim() ? (
                          <p className="mt-0.5 text-xs text-gray-500">{variant.cn_name}</p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-xs text-gray-500">{variant.sku ?? '—'}</p>
                        {variant.track_stock ? (
                          <p className="mt-1 text-xs text-gray-500">
                            Stock: <span className="font-semibold">{variant.stock ?? 0}</span>
                          </p>
                        ) : null}
                        {isVariantOutOfStock(variant) ? (
                          <p className="mt-1 text-xs font-bold text-red-600">Out of stock</p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : isSimpleProductOutOfStock(product) ? (
              <div className="rounded-xl border-2 border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                Out of stock
              </div>
            ) : stockMeta.trackStock ? (
              <p className="text-sm text-gray-600">
                Stock available: <span className="font-semibold text-gray-900">{stockMeta.stock ?? 0}</span>
              </p>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-900">Quantity</label>
                {typeof maxQty === 'number' ? (
                  <span className="text-xs font-medium text-gray-500">
                    Max: <span className="font-semibold text-gray-800">{maxQty}</span>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-lg font-bold text-gray-700 hover:bg-gray-50"
                  onClick={() => setQty((prev) => clampQty(prev - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={maxQty ?? undefined}
                  value={qty}
                  onChange={(event) => setQty(clampQty(Number(event.target.value)))}
                  className="h-11 w-24 rounded-lg border-2 border-gray-300 text-center text-sm font-bold text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-lg font-bold text-gray-700 hover:bg-gray-50"
                  onClick={() => setQty((prev) => clampQty(prev + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </div>
      </div>
    </CrmFormModalShell>
  )
}
