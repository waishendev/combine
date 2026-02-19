'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'

type CartItem = {
  id: number
  qty: number
  unit_price: number
  line_total: number
  product_id?: number | null
  variant_id?: number | null
  product_name?: string | null
  variant_name?: string | null
  variant_sku?: string | null
}

type Cart = {
  id: number
  items: CartItem[]
  subtotal: number
  grand_total: number
}

type ProductOption = {
  id: number
  product_id: number
  name: string
  sku: string
  barcode: string
  price: number
  thumbnail_url?: string | null
  variants: ProductVariantOption[]
  default_variant_id?: number | null
}

type ProductVariantOption = {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  thumbnail_url?: string | null
  is_active: boolean
  track_stock?: boolean | null
  stock?: number | null
}

type CheckoutMeta = {
  paid_amount: number
  change_amount: number
}

type Member = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  member_code?: string | null
  avatar_url?: string | null
}

type PageResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}


type VariantPayload = {
  id?: number | string
  title?: string | null
  name?: string | null
  sku?: string | null
  price?: number | string | null
  sale_price?: number | string | null
  image_url?: string | null
  is_active?: boolean | string | number
  track_stock?: boolean | string | number | null
  stock?: number | string | null
}

type ProductApiItem = {
  id: number
  name?: string
  sku?: string
  price?: number | string
  cover_image_url?: string | null
  variants?: Array<{
    id?: number
    name?: string | null
    sku?: string | null
    price?: number | string | null
    sale_price?: number | string | null
    image_url?: string | null
    is_active?: boolean | string | number
  }>
}

function extractPaged<T>(json: unknown): PageResponse<T> {
  const payloadAny: any =
    typeof json === 'object' && json !== null && 'data' in json ? (json as any).data : undefined

  if (payloadAny && typeof payloadAny === 'object' && Array.isArray(payloadAny.data)) {
    return {
      data: payloadAny.data as T[],
      current_page: Number(payloadAny.current_page ?? 1),
      last_page: Number(payloadAny.last_page ?? 1),
      per_page: Number(payloadAny.per_page ?? payloadAny.data.length ?? 0),
      total: Number(payloadAny.total ?? payloadAny.data.length ?? 0),
    }
  }

  if (payloadAny && Array.isArray(payloadAny)) {
    return {
      data: payloadAny as T[],
      current_page: 1,
      last_page: 1,
      per_page: payloadAny.length,
      total: payloadAny.length,
    }
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
  }
}

export default function PosPageContent() {
  const scannerInputRef = useRef<HTMLInputElement | null>(null)
  const qrUploadInputRef = useRef<HTMLInputElement | null>(null)
  const qrCameraBackInputRef = useRef<HTMLInputElement | null>(null)
  const qrCameraFrontInputRef = useRef<HTMLInputElement | null>(null)

  const [cart, setCart] = useState<Cart | null>(null)

  const [productQuery, setProductQuery] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productPage, setProductPage] = useState(1)
  const [productLastPage, setProductLastPage] = useState(1)
  const [productLoading, setProductLoading] = useState(false)
  const [productHighlighted, setProductHighlighted] = useState(0)
  const [productSelectModalOpen, setProductSelectModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [productVariantLoading, setProductVariantLoading] = useState(false)
  const [selectedProductQty, setSelectedProductQty] = useState(1)
  const [fullProductData, setFullProductData] = useState<any>(null)

  const [memberOpen, setMemberOpen] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [memberPage, setMemberPage] = useState(1)
  const [memberLastPage, setMemberLastPage] = useState(1)
  const [memberLoading, setMemberLoading] = useState(false)
  const [memberInitialLoaded, setMemberInitialLoaded] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qrpay'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [checkoutMeta, setCheckoutMeta] = useState<CheckoutMeta | null>(null)
  const [confirmCashOpen, setConfirmCashOpen] = useState(false)
  const [qrProofFileName, setQrProofFileName] = useState<string | null>(null)
  const [qrProofPreviewUrl, setQrProofPreviewUrl] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const [cartVariantOptions, setCartVariantOptions] = useState<Record<number, ProductVariantOption[]>>({})
  const [cartVariantLoading, setCartVariantLoading] = useState<Record<number, boolean>>({})
  const [cartVariantFetched, setCartVariantFetched] = useState<Record<number, boolean>>({})
  const [checkoutResult, setCheckoutResult] = useState<null | {
    order_number: string
    receipt_public_url: string | null
    total: number
    payment_method: 'cash' | 'qrpay'
    paid_amount: number
    change_amount: number
  }>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [qrCodeFullscreen, setQrCodeFullscreen] = useState(false)

  const totalItems = useMemo(() => cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0, [cart])
  const cartSubtotal = Number(cart?.subtotal ?? cart?.grand_total ?? 0)
  const cartTotal = Number(cart?.grand_total ?? 0)
  const discount = Math.max(0, cartSubtotal - cartTotal)

  type ToastKind = 'success' | 'error' | 'info' | 'warning'
  type ToastItem = { id: string; kind: ToastKind; text: string }

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((kind: ToastKind, text: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const nextToast: ToastItem = { id, kind, text }

    setToasts((prev) => {
      const next = [...prev, nextToast]
      return next.slice(-4) // keep it tidy on iPad
    })

    window.setTimeout(() => dismissToast(id), 3200)
  }, [dismissToast])


  const focusScanner = () => {
    scannerInputRef.current?.focus()
  }

  const clearScannerInput = () => {
    if (scannerInputRef.current) {
      scannerInputRef.current.value = ''
    }
  }

  const showMsg = (text: string, kind: ToastKind = 'info') => pushToast(kind, text)

  async function loadCart() {
    const res = await fetch('/api/proxy/pos/cart', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
    }
  }

  async function addByBarcode(barcode: string, qty = 1) {
    const trimmed = barcode.trim()
    if (!trimmed) return false

    const res = await fetch('/api/proxy/pos/cart/add-by-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: trimmed, qty }),
    })
    const json = await res.json()

    if (res.ok) {
      setCart(json.data.cart)
      showMsg('Added to cart.', 'success')
      return true
    }

    if (res.status === 404) {
      showMsg('Barcode not found.', 'error')
      return false
    }

    showMsg(json?.message ?? 'Unable to add item.', 'error')
    return false
  }

  async function addBySelection(payload: { variant_id?: number; product_id?: number }, qty = 1) {
    const variantId = Number(payload.variant_id)
    const productId = Number(payload.product_id)

    if ((!Number.isFinite(variantId) || variantId <= 0) && (!Number.isFinite(productId) || productId <= 0)) {
      return false
    }

    const body: Record<string, number> = { qty }
    if (Number.isFinite(variantId) && variantId > 0) {
      body.variant_id = variantId
    } else if (Number.isFinite(productId) && productId > 0) {
      body.product_id = productId
    }

    const res = await fetch('/api/proxy/pos/cart/add-by-variant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()

    if (res.ok) {
      setCart(json.data.cart)
      showMsg('Added to cart.', 'success')
      return true
    }

    showMsg(json?.message ?? 'Unable to add selected product.', 'error')
    return false
  }

  const resolveVariantIdFromPayload = (payload: unknown): number | null => {
    if (!payload || typeof payload !== 'object' || !('variants' in payload)) return null

    const payloadWithVariants = payload as { variants?: unknown }
    if (!Array.isArray(payloadWithVariants.variants)) return null

    const variants = payloadWithVariants.variants as VariantPayload[]
    const activeVariant = variants.find((variant) => variant && (variant.is_active === true || variant.is_active === '1' || variant.is_active === 1 || variant.is_active === 'true'))
    const fallbackVariant = variants[0]
    const variantId = Number((activeVariant ?? fallbackVariant)?.id)

    return Number.isFinite(variantId) && variantId > 0 ? variantId : null
  }


  const normalizeProductFromApi = (item: ProductApiItem): ProductOption | null => {
    const productId = Number(item.id)
    if (!Number.isFinite(productId) || productId <= 0) return null

    const variants: ProductVariantOption[] = Array.isArray(item.variants)
      ? item.variants
          .map((variant): ProductVariantOption | null => {
            const variantId = Number(variant?.id)
            if (!Number.isFinite(variantId) || variantId <= 0) return null

            const sku = variant?.sku?.trim() || ''
            if (!sku) return null

            const priceRaw = variant?.sale_price ?? variant?.price ?? item.price ?? 0
            const parsedPrice = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw || 0)

            const variantAny = variant as VariantPayload
            return {
              id: variantId,
              name: variant?.name?.trim() || `Variant #${variantId}`,
              sku,
              barcode: sku,
              price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
              thumbnail_url: variant?.image_url ?? item.cover_image_url ?? null,
              is_active: variant?.is_active === true || variant?.is_active === '1' || variant?.is_active === 1 || variant?.is_active === 'true',
              track_stock: variantAny?.track_stock === true || variantAny?.track_stock === '1' || variantAny?.track_stock === 1 || variantAny?.track_stock === 'true' || null,
              stock: typeof variantAny?.stock === 'number' ? variantAny.stock : Number(variantAny?.stock || 0) || null,
            }
          })
          .filter((variant): variant is ProductVariantOption => Boolean(variant))
      : []

    const activeVariant = variants.find((variant) => variant.is_active) ?? variants[0] ?? null
    const baseSku = item.sku?.trim() || ''
    const sku = activeVariant?.sku || baseSku
    if (!sku) return null

    const priceRaw = activeVariant?.price ?? item.price ?? 0
    const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw || 0)

    return {
      // IMPORTANT: keep the list/grid unique by product id (like Shop).
      // Variants should only be selected inside the modal / cart item variant selector.
      id: productId,
      product_id: productId,
      name: item.name ?? '-',
      sku,
      barcode: sku,
      price: Number.isFinite(price) ? price : 0,
      thumbnail_url: activeVariant?.thumbnail_url ?? item.cover_image_url ?? null,
      variants,
      default_variant_id: activeVariant?.id ?? variants[0]?.id ?? null,
    }
  }

  const hydrateProductVariants = async (item: ProductOption) => {
    const productId = Number(item.product_id || item.id)
    if (!Number.isFinite(productId) || productId <= 0) return

    setProductVariantLoading(true)

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${productId}`, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) return

      const payload = json?.data?.product ?? json?.data ?? json?.product
      if (!payload || typeof payload !== 'object') return

      // Store full product data for the modal
      setFullProductData(payload)

      const normalized = normalizeProductFromApi(payload as ProductApiItem)
      if (!normalized) return

      // Update selected product with correct data, preserving the original product_id
      setSelectedProduct((current) => {
        if (!current) return current
        const currentProductId = Number(current.product_id || current.id)
        if (currentProductId !== productId) return current
        
        // Merge normalized data but keep the original product_id
        return {
          ...normalized,
          product_id: productId, // Ensure product_id is correct
          name: payload.name ?? current.name, // Use payload name to ensure correctness
        }
      })
      
      // Auto-select variant if there's only one, or if no variants and we need to find the first variant from payload
      setSelectedVariantId((currentVariantId) => {
        if (currentVariantId) return currentVariantId
        
        if (normalized.variants.length === 1) {
          return normalized.variants[0].id
        }
        
        // If no variants in normalized but payload has variants, use the first one
        if (normalized.variants.length === 0 && Array.isArray(payload.variants) && payload.variants.length > 0) {
          const firstVariant = payload.variants[0]
          const variantId = Number(firstVariant?.id)
          if (Number.isFinite(variantId) && variantId > 0) {
            return variantId
          }
        }
        
        return null
      })
    } catch {
      // no-op; keep fallback product information
    } finally {
      setProductVariantLoading(false)
    }
  }

  const dedupeByProductId = (items: ProductOption[]) => {
    const map = new Map<number, ProductOption>()
    for (const item of items) {
      const pid = Number(item.product_id || item.id)
      if (!Number.isFinite(pid) || pid <= 0) continue

      if (!map.has(pid)) {
        map.set(pid, item)
        continue
      }

      // Prefer the one that has variants / image / better price if duplicates show up from API/search.
      const existing = map.get(pid)!
      const existingScore =
        (existing.variants?.length ? 10 : 0) +
        (existing.thumbnail_url ? 3 : 0) +
        (Number(existing.price ?? 0) > 0 ? 1 : 0)
      const nextScore =
        (item.variants?.length ? 10 : 0) +
        (item.thumbnail_url ? 3 : 0) +
        (Number(item.price ?? 0) > 0 ? 1 : 0)

      if (nextScore > existingScore) {
        map.set(pid, item)
      }
    }
    return Array.from(map.values())
  }

  const fetchProductPage = useCallback(async (page: number, keyword: string, append: boolean) => {
    setProductLoading(true)

    let mapped: ProductOption[] = []
    let currentPage = page
    let lastPage = page

    if (keyword.trim()) {
      const res = await fetch(`/api/proxy/pos/products/search?q=${encodeURIComponent(keyword.trim())}&page=${page}&per_page=100`)
      const json = await res.json()
      const paged = extractPaged<ProductOption>(json)
      mapped = paged.data.map((item) => {
        const resolvedProductId = Number(item.product_id)

        return {
          ...item,
          product_id: Number.isFinite(resolvedProductId) && resolvedProductId > 0 ? resolvedProductId : Number(item.id),
          variants: Array.isArray(item.variants) ? item.variants : [],
        }
      })
      currentPage = paged.current_page
      lastPage = paged.last_page
    } else {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', '100')
      params.set('is_active', 'true')

      const res = await fetch(`/api/proxy/ecommerce/products?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      const paged = extractPaged<ProductApiItem>(json)

      mapped = paged.data
        .map((item): ProductOption | null => normalizeProductFromApi(item))
        .filter((item): item is ProductOption => Boolean(item))

      currentPage = paged.current_page
      lastPage = paged.last_page
    }

    // Ensure we never display variants as extra "products" in the grid.
    setProducts((prev) => {
      const next = append ? [...prev, ...mapped] : mapped
      return dedupeByProductId(next)
    })
    setProductPage(currentPage)
    setProductLastPage(lastPage)
    setProductHighlighted(0)
    setProductLoading(false)
  }, [])

  const fetchMemberPage = useCallback(async (page: number, keyword: string, append: boolean) => {
    setMemberLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('per_page', '100')
    if (keyword.trim()) {
      params.set('q', keyword.trim())
    }

    const res = await fetch(`/api/proxy/pos/members/search?${params.toString()}`)
    const json = await res.json()
    const paged = extractPaged<Member>(json)

    setMembers((prev) => (append ? [...prev, ...paged.data] : paged.data))
    setMemberPage(paged.current_page)
    setMemberLastPage(paged.last_page)
    setMemberLoading(false)
  }, [])

  const updateQty = async (itemId: number, qty: number) => {
    if (qty < 1) return
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
    }
  }

  const removeItem = async (itemId: number) => {
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
    }
  }

  useEffect(() => {
    focusScanner()
    void loadCart()
    // Load products on initial mount
    void fetchProductPage(1, '', false)
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchProductPage(1, productQuery, false)
    }, 300)

    return () => clearTimeout(handle)
  }, [fetchProductPage, productQuery])

  useEffect(() => {
    if (!memberOpen) return

    const handle = setTimeout(() => {
      void fetchMemberPage(1, memberQuery, false)
    }, 300)

    return () => clearTimeout(handle)
  }, [fetchMemberPage, memberQuery, memberOpen])

  const onScannerEnter = async () => {
    const value = scannerInputRef.current?.value ?? ''
    clearScannerInput()

    if (!value.trim()) {
      focusScanner()
      return
    }

    await addByBarcode(value)
    focusScanner()
  }

  const onSelectProduct = (item: ProductOption) => {
    setFullProductData(null)
    setSelectedProduct(item)
    setSelectedVariantId(item.variants.length === 1 ? item.variants[0].id : null)
    setSelectedProductQty(1)
    setProductSelectModalOpen(true)
    void hydrateProductVariants(item)
  }

  const confirmAddSelectedProduct = async () => {
    if (!selectedProduct) return

    let variantIdToUse: number | null = null

    if (selectedProduct.variants.length > 0) {
      variantIdToUse = selectedVariantId ?? selectedProduct.variants[0]?.id ?? null
    }

    if (!variantIdToUse) {
      variantIdToUse = resolveVariantIdFromPayload(fullProductData)
    }

    if (!variantIdToUse) {
      const productId = Number(selectedProduct.product_id || selectedProduct.id)
      if (Number.isFinite(productId) && productId > 0) {
        try {
          const res = await fetch(`/api/proxy/ecommerce/products/${productId}`, { cache: 'no-store' })
          const json = await res.json()
          if (res.ok) {
            const payload = json?.data?.product ?? json?.data ?? json?.product
            variantIdToUse = resolveVariantIdFromPayload(payload)
            if (payload) setFullProductData(payload)
          }
        } catch {
          // no-op
        }
      }
    }

    const productId = Number(selectedProduct.product_id || selectedProduct.id)
    const success = await addBySelection(
      variantIdToUse && variantIdToUse > 0
        ? { variant_id: variantIdToUse }
        : { product_id: productId },
      selectedProductQty,
    )
    if (!success) return

    setProductSelectModalOpen(false)
    setSelectedProduct(null)
    setSelectedVariantId(null)
    setProductVariantLoading(false)
    setFullProductData(null)
    focusScanner()
  }

  const quickAddProduct = async (item: ProductOption) => {
    if (item.variants.length > 0) {
      onSelectProduct(item)
      return
    }

    const productId = Number(item.product_id || item.id)
    if (!Number.isFinite(productId) || productId <= 0) {
      showMsg('Invalid product ID.', 'error')
      return
    }

    await addBySelection({ product_id: productId }, 1)
  }


  const fetchCartItemVariants = async (item: CartItem) => {
    if (!item.product_id || cartVariantOptions[item.id]?.length || cartVariantLoading[item.id] || cartVariantFetched[item.id]) return

    setCartVariantLoading((prev) => ({ ...prev, [item.id]: true }))

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${item.product_id}`, { cache: 'no-store' })
      const json = await res.json()
      const payload = json?.data?.product ?? json?.data ?? json?.product

      const options: ProductVariantOption[] = Array.isArray(payload?.variants)
        ? payload.variants
            .map((variant: VariantPayload): ProductVariantOption | null => {
              const id = Number(variant?.id)
              const sku = variant?.sku?.trim() || ''
              const price = Number(variant?.sale_price ?? variant?.price ?? 0)
              if (!Number.isFinite(id) || id <= 0 || !sku) return null

              return {
                id,
                name: variant?.title?.trim() || variant?.name?.trim() || sku,
                sku,
                barcode: sku,
                price: Number.isFinite(price) ? price : 0,
                thumbnail_url: variant?.image_url ?? payload?.cover_image_url ?? null,
                is_active: variant?.is_active === true || variant?.is_active === '1' || variant?.is_active === 1 || variant?.is_active === 'true',
                track_stock: variant?.track_stock === true || variant?.track_stock === '1' || variant?.track_stock === 1 || variant?.track_stock === 'true' || null,
                stock: typeof variant?.stock === 'number' ? variant.stock : Number(variant?.stock || 0) || null,
              }
            })
            .filter((variant: ProductVariantOption | null): variant is ProductVariantOption => Boolean(variant))
        : []

      setCartVariantOptions((prev) => ({ ...prev, [item.id]: options }))
    } finally {
      setCartVariantLoading((prev) => ({ ...prev, [item.id]: false }))
      setCartVariantFetched((prev) => ({ ...prev, [item.id]: true }))
    }
  }

  const updateItemVariant = async (item: CartItem, variantId: number) => {
    if (!Number.isFinite(variantId) || variantId <= 0 || item.variant_id === variantId) return

    const res = await fetch(`/api/proxy/pos/cart/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: variantId, qty: item.qty }),
    })
    const json = await res.json()

    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to change variant.', 'error')
      return
    }

    setCart(json.data.cart)
    showMsg('Variant updated.', 'success')
    setCartVariantOptions((prev) => ({ ...prev, [item.id]: [] }))
    setCartVariantFetched((prev) => ({ ...prev, [item.id]: false }))
  }


  useEffect(() => {
    if (!cart?.items?.length) return

    const itemsToPrefetch = cart.items.filter((item) => {
      if (!item.product_id) return false
      // Single products don't have variant switchers and should not trigger variant prefetch loops.
      if (!item.variant_id) return false
      if (cartVariantOptions[item.id]?.length) return false
      if (cartVariantLoading[item.id]) return false
      if (cartVariantFetched[item.id]) return false
      return true
    })

    itemsToPrefetch.forEach((item) => {
      void fetchCartItemVariants(item)
    })
  }, [cart, cartVariantFetched, cartVariantOptions, cartVariantLoading])

  const cashReceivedAmount = Number(cashReceived || 0)
  const cashChange = Math.max(0, cashReceivedAmount - cartTotal)

  // Enhanced checkout validation: must have items, and payment method requirements must be met
  const canCheckout = Boolean(cart?.items.length) && !checkingOut && (
    paymentMethod === 'cash' 
      ? Number.isFinite(cashReceivedAmount) && cashReceivedAmount >= cartTotal
      : Boolean(qrProofFileName)
  )

  const finalizeCheckout = async (meta: CheckoutMeta) => {
    if (!cart || cart.items.length === 0 || checkingOut) return

    setCheckingOut(true)
    setCheckoutError(null)

    const res = await fetch('/api/proxy/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: paymentMethod, member_id: selectedMember?.id ?? null }),
    })
    const json = await res.json()

    if (!res.ok) {
      setCheckoutError(json?.message ?? 'Checkout failed. Please try again.')
      setCheckingOut(false)
      return
    }

    setCheckoutResult({
      order_number: json.data.order.order_number,
      receipt_public_url: json.data.receipt_public_url,
      total: Number(json.data.order.grand_total ?? 0),
      payment_method: paymentMethod,
      paid_amount: meta.paid_amount,
      change_amount: meta.change_amount,
    })
    setSelectedMember(null)
    setMemberQuery('')
    setMembers([])
    setCart({ id: cart.id, items: [], subtotal: 0, grand_total: 0 })
    setCashReceived('')
    setCheckoutMeta(null)
    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }
    setQrProofPreviewUrl(null)
    setQrProofFileName(null)
    setCheckingOut(false)
    // Don't show toast, will show success modal instead
    focusScanner()
  }

  const checkout = async () => {
    if (!cart || cart.items.length === 0 || checkingOut) return

    if (paymentMethod === 'qrpay') {
      if (!qrProofFileName) {
        showMsg('Please upload QR payment proof before checkout.', 'error')
        return
      }

      await finalizeCheckout({ paid_amount: cartTotal, change_amount: 0 })
      return
    }

    // Handle cash flow a bit more like retail POS:
    // - If staff didn't key in anything, suggest a rounded cash amount automatically
    // - Still validate that received cash covers the total
    let effectiveCashReceived = cashReceivedAmount

    if (!cashReceived || !cashReceived.trim()) {
      const suggested = Math.ceil(cartTotal || 0)
      effectiveCashReceived = suggested
      setCashReceived(suggested.toFixed(2))
    }

    if (!Number.isFinite(effectiveCashReceived) || effectiveCashReceived < cartTotal) {
      showMsg('Cash received must be equal or more than total.', 'error')
      return
    }

    const effectiveChange = Math.max(0, effectiveCashReceived - cartTotal)

    setCheckoutMeta({ paid_amount: effectiveCashReceived, change_amount: effectiveChange })
    setConfirmCashOpen(true)
  }

  const toggleMemberDropdown = async () => {
    if (memberOpen) {
      setMemberOpen(false)
      setMemberQuery('')
      return
    }

    setMemberOpen(true)
    if (!memberInitialLoaded) {
      setMemberInitialLoaded(true)
      await fetchMemberPage(1, '', false)
    }
  }

  const onSelectQrProof: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }

    const url = URL.createObjectURL(file)
    setQrProofFileName(file.name)
    setQrProofPreviewUrl(url)
    event.currentTarget.value = ''
  }

  const clearQrProof = () => {
    if (qrProofPreviewUrl) {
      URL.revokeObjectURL(qrProofPreviewUrl)
    }
    setQrProofPreviewUrl(null)
    setQrProofFileName(null)
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">POS Checkout</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5 xl:min-h-0">
        <div className="space-y-5 xl:col-span-3 xl:min-h-0">
          {/* Barcode Scanner Input - moved into left column above Products for better POS flow */}
          <div className="flex min-h-[200px] flex-col rounded-xl border-2 border-gray-200 bg-white p-5 shadow-md xl:h-[180px]">
            <label className="mb-3 block text-sm font-bold text-gray-900 flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Barcode Scanner
            </label>
            <input
              ref={scannerInputRef}
              type="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onScannerEnter()
                }
              }}
              className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-4 py-3.5 text-base font-mono focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="Scan barcode (most scanners auto-press Enter) or type manually, then press Enter..."
              autoFocus
            />
            <p className="mt-2.5 text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Scan with barcode scanner to add items. If typing by hand, press Enter to confirm.
            </p>
          </div>

          {/* Products Section - Always Visible */}
          <div className="flex min-h-[420px] flex-col rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md xl:h-[calc(100vh-10rem)] xl:min-h-0">
            <h3 className="mb-5 text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Products
            </h3>
            
            {/* Search Bar */}
            <div className="mb-5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Search products by name, SKU, or barcode..."
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid min-h-[260px] flex-1 grid-cols-1 gap-3 overflow-auto p-1 sm:grid-cols-2 xl:min-h-0 xl:grid-cols-2">
              {products.map((item, idx) => (
                <div
                  key={item.product_id}
                  role="button"
                  tabIndex={0}
                  className={`group cursor-pointer overflow-hidden rounded-xl border-2 bg-white transition-all shadow-sm flex flex-row h-[100px] ${idx === productHighlighted ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'}`}
                  onMouseEnter={() => setProductHighlighted(idx)}
                  onClick={() => void onSelectProduct(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void onSelectProduct(item)
                    }
                  }}
                >
                  {/* Product Image - Left Side */}
                  <div className="w-[100px] h-full bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden flex-shrink-0">
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail_url} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                        <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Product Info - Right Side */}
                  <div className="flex flex-col flex-1 p-3 bg-white min-h-0 justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight text-gray-900 line-clamp-2 mb-1">{item.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{item.sku || item.barcode}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-sm font-bold text-gray-900">RM {Number(item.price ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {!productLoading && products.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-2 text-4xl">📦</div>
                  <p className="text-sm font-medium text-gray-600">No products found</p>
                  <p className="mt-1 text-xs text-gray-500">Try adjusting your search</p>
                </div>
              )}

              {productLoading && products.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-gray-500">Loading products...</div>
              )}
            </div>

            {/* Pagination */}
            {products.length > 0 && productPage < productLastPage && (
              <div className="mt-4 flex items-center justify-end border-t pt-4">
                <button
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:bg-white disabled:hover:text-gray-700"
                  disabled={productLoading}
                  onClick={() => void fetchProductPage(productPage + 1, productQuery, true)}
                >
                  {productLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    `View More (${productPage + 1}/${productLastPage})`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>


        <div className="space-y-5 xl:col-span-2 xl:min-h-0">

                    {/* Member Assignment Section - Moved to Right Side */}
          <div className="flex min-h-[200px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm sm:p-5 xl:h-[180px]">
            <h3 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900 flex-shrink-0">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              Member Assignment
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Optional</span>
            </h3>

            <div className="flex-1 flex min-h-0">
            {selectedMember ? (
              <div className="w-full overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  {selectedMember.avatar_url ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border-2 border-blue-300 shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedMember.avatar_url} alt={selectedMember.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border-2 border-blue-300 shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/default_user_image.jpg" alt={selectedMember.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                      {selectedMember.name}
                      {selectedMember.phone && <span className="ml-1.5 text-xs font-normal text-gray-600">({selectedMember.phone})</span>}
                    </p>
                    {selectedMember.email && (
                      <p className="mt-1 text-xs text-gray-700 truncate flex items-center gap-1">
                        <svg className="h-3 w-3 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{selectedMember.email}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-blue-200 pt-2">
                  <button
                    onClick={() => void toggleMemberDropdown()}
                    className="inline-flex min-w-[120px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1-1v2m0 6v7m-7-7h14" />
                    </svg>
                    Change
                  </button>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => void toggleMemberDropdown()}
                className="group relative w-full h-full overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 px-4 py-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400 hover:from-blue-50 hover:via-blue-100/40 hover:to-indigo-50/30 hover:shadow-lg active:scale-[0.98]"
              >
                {/* Decorative background pattern */}
                <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-blue-200/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="relative flex items-center gap-3.5">
                  {/* Enhanced Icon Container */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-200 text-blue-700 shadow-md ring-2 ring-blue-50 transition-all duration-300 group-hover:scale-110 group-hover:from-blue-200 group-hover:via-blue-300 group-hover:to-indigo-300 group-hover:shadow-lg">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                      Assign Member
                    </p>
                  </div>
                  
                  {/* Arrow Icon */}
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
            </div>
          </div>

            <div className="flex min-h-[420px] flex-col rounded-xl border-2 border-gray-200 bg-white p-5 shadow-md xl:h-[calc(100vh-10rem)] xl:min-h-0">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 flex-shrink-0">
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Shopping Cart
            </h3>
            {cart?.items.length ? (
              <div className="mt-3 min-h-[220px] flex-1 space-y-3 overflow-y-auto pr-1 xl:min-h-0">
                {cart.items.map((item) => (
                  <div key={item.id} className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate sm:max-w-[200px]" title={item.product_name || undefined}>{item.product_name}</p>
                        <p className="mt-0.5 text-xs font-mono text-gray-600 truncate sm:max-w-[200px]" title={(item.variant_sku || item.variant_name || '') || undefined}>{item.variant_sku || item.variant_name || ''}</p>
                      </div>
                      <div className="flex w-fit items-center gap-2 rounded-lg bg-gray-100 p-1">
                        <button onClick={() => void updateQty(item.id, item.qty - 1)} className="h-7 w-7 rounded-md border-2 border-gray-300 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95">-</button>
                        <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                        <button onClick={() => void updateQty(item.id, item.qty + 1)} className="h-7 w-7 rounded-md border-2 border-gray-300 bg-white font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95">+</button>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className="min-w-[90px] text-left text-sm font-bold text-gray-900 sm:text-right">RM {Number(item.line_total).toFixed(2)}</span>
                        <button 
                          onClick={() => void removeItem(item.id)} 
                          className="rounded-md p-2 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
                          title="Remove item"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {!!item.product_id && (item.variant_id || (cartVariantOptions[item.id]?.length ?? 0) > 0) && (
                      <div className="mt-2">
                        <select
                          className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs"
                          value={item.variant_id ? String(item.variant_id) : ''}
                          onFocus={() => { if (item.variant_id) void fetchCartItemVariants(item) }}
                          onChange={(e) => void updateItemVariant(item, Number(e.target.value))}
                          disabled={cartVariantLoading[item.id]}
                        >
                          <option value="" disabled>{cartVariantLoading[item.id] ? 'Loading variants...' : 'Select variant'}</option>
                          {(cartVariantOptions[item.id] ?? []).map((variant) => <option key={variant.id} value={String(variant.id)}>{variant.name} ({variant.sku})</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="mt-2 text-sm font-bold text-gray-700">Cart is empty</p>
                <p className="text-xs text-gray-500 mt-1">Scan or add products to start</p>
              </div>
            )}

            <div className="mt-5 rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm">
              {/* Order Summary inside payment card for clearer iPad POS flow */}
              <div className="mb-4 space-y-1 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                {/* <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">RM {cartSubtotal.toFixed(2)}</span>
                </div> */}
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-semibold text-green-600">-RM {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-lg text-gray-900">RM {cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <h4 className="text-base font-bold text-gray-900 mb-3">Payment Method</h4>
              <div className="mt-3 space-y-2">
                <label className={`flex cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className={paymentMethod === 'cash' ? 'text-blue-700 font-bold' : 'text-gray-700'}>Cash</span>
                  <input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="h-4 w-4 text-blue-600" />
                </label>
                <label className={`flex cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${paymentMethod === 'qrpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className={paymentMethod === 'qrpay' ? 'text-blue-700 font-bold' : 'text-gray-700'}>QRPay</span>
                  <input type="radio" checked={paymentMethod === 'qrpay'} onChange={() => setPaymentMethod('qrpay')} className="h-4 w-4 text-blue-600" />
                </label>
              </div>
              {paymentMethod === 'cash' && (
                <div className="mt-4 space-y-3 rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                  <label className="block text-sm font-bold text-gray-900">Cash Received</label>
                  <input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    value={cashReceived} 
                    onChange={(e) => setCashReceived(e.target.value)} 
                    className="h-11 w-full rounded-lg border-2 border-gray-300 bg-white px-4 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
                    placeholder="0.00" 
                  />
                  {cashChange > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-green-50 border-2 border-green-200 px-3 py-2">
                      <span className="text-xs font-semibold text-green-800">Change:</span>
                      <span className="text-sm font-bold text-green-700">RM {cashChange.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              {paymentMethod === 'qrpay' && (
                <div className="mt-4 space-y-3 rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                  <label className="block text-sm font-bold text-gray-900">Upload Payment Proof</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95" onClick={() => qrUploadInputRef.current?.click()}>
                      📁 Upload
                    </button>
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95" onClick={() => qrCameraBackInputRef.current?.click()}>
                      📷 Back Camera
                    </button>
                    <button type="button" className="h-10 rounded-lg border-2 border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 active:scale-95" onClick={() => qrCameraFrontInputRef.current?.click()}>
                      📷 Front Camera
                    </button>
                  </div>
                  <input ref={qrUploadInputRef} type="file" accept="image/*" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectQrProof} className="sr-only" />
                  {qrProofFileName && (
                    <div className="flex items-center justify-between rounded-lg border-2 border-green-200 bg-green-50 px-3 py-2">
                      <p className="truncate pr-2 text-xs font-medium text-green-800">✓ {qrProofFileName}</p>
                      <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-700 underline" onClick={clearQrProof}>Clear</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={() => void checkout()} 
              disabled={!canCheckout} 
              className="mt-5 h-14 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-base font-bold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none active:scale-[0.98]"
            >
              {checkingOut ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Checkout'
              )}
            </button>
            </div>
        </div>
      </div>

      {productSelectModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border-2 border-gray-100 my-8 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 rounded-t-2xl">
              <h4 className="text-xl font-bold text-gray-900">Product Details</h4>
              <button
                onClick={() => {
                  setProductSelectModalOpen(false)
                  setSelectedProduct(null)
                  setSelectedVariantId(null)
                  setProductVariantLoading(false)
                  setFullProductData(null)
                }}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              {/* Left: Product Images */}
              <div className="space-y-4">
                {productVariantLoading ? (
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center border-2 border-gray-200">
                    <div className="text-center">
                      <svg className="h-12 w-12 mx-auto mb-2 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm font-medium text-gray-500">Loading...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {fullProductData?.images?.[0]?.url || fullProductData?.cover_image_url || selectedProduct.thumbnail_url ? (
                      <div className="aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fullProductData?.images?.[0]?.url || fullProductData?.cover_image_url || selectedProduct.thumbnail_url || ''}
                          alt={selectedProduct.name || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square w-full bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center border-2 border-gray-200">
                        <div className="text-center">
                          <svg className="h-16 w-16 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm font-medium text-gray-400">No image</p>
                        </div>
                      </div>
                    )}
                    {fullProductData?.images && fullProductData.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {fullProductData.images.slice(0, 4).map((img: any, idx: number) => (
                          <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url || ''} alt={`${selectedProduct.name} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right: Product Info */}
              <div className="space-y-5">
                {(() => {
                  // Derive currently selected / primary variant for stock display
                  const selectedVariant =
                    (selectedProduct.variants.length > 0 &&
                      (selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? selectedProduct.variants[0])) ||
                    null

                  const trackStock = selectedVariant?.track_stock ?? null
                  const stockValue =
                    typeof selectedVariant?.stock === 'number' && Number.isFinite(selectedVariant.stock)
                      ? selectedVariant.stock
                      : null

                  const hasStockLimit = (trackStock ?? true) && stockValue !== null && stockValue >= 0

                  return null
                })()}

                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h1>
                  <p className="text-sm text-gray-500 mt-1.5 font-mono">{selectedProduct.sku || selectedProduct.barcode}</p>
                </div>

                {/* Price */}
                <div className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-gray-900">
                      RM {selectedVariantId && selectedProduct.variants.length > 0
                        ? Number(selectedProduct.variants.find(v => v.id === selectedVariantId)?.price ?? selectedProduct.price ?? 0).toFixed(2)
                        : Number(selectedProduct.price ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Variants */}
                {productVariantLoading ? (
                  <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-500">Loading variants...</p>
                  </div>
                ) : selectedProduct.variants.length > 0 ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-900">Select Variant</label>
                    <div className="grid gap-2.5 max-h-64 overflow-y-auto">
                      {selectedProduct.variants.map((variant) => {
                        const selected = variant.id === selectedVariantId
                        const isActive = variant.is_active !== false
                        const outOfStock = (variant.track_stock ?? true) && (variant.stock ?? 0) <= 0
                        return (
                          <button
                            type="button"
                            key={variant.id}
                            onClick={() => isActive && !outOfStock && setSelectedVariantId(variant.id)}
                            disabled={!isActive || outOfStock}
                            className={`rounded-xl border-2 p-4 text-left transition-all ${
                              selected
                                ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/20'
                                : !isActive || outOfStock
                                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-900">{variant.name}</p>
                                <p className="text-xs text-gray-600 mt-0.5 font-mono">{variant.sku}</p>
                                <p className="text-sm font-bold text-gray-900 mt-1.5">RM {variant.price.toFixed(2)}</p>
                                {typeof variant.stock === 'number' && (variant.track_stock ?? true) && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Stock: <span className="font-semibold text-gray-800">{variant.stock}</span>
                                  </p>
                                )}
                              </div>
                              {outOfStock && (
                                <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded">Out of Stock</span>
                              )}
                              {selected && !outOfStock && (
                                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Description */}
                {fullProductData?.description && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold">Description</label>
                    <div className="prose max-w-none text-sm text-gray-700 whitespace-pre-line">
                      {fullProductData.description}
                    </div>
                  </div>
                )}

                {/* Quantity with stock awareness */}
                <div className="space-y-3">
                  {(() => {
                    const selectedVariant =
                      (selectedProduct.variants.length > 0 &&
                        (selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? selectedProduct.variants[0])) ||
                      null

                    const trackStock = selectedVariant?.track_stock ?? null
                    const stockValue =
                      typeof selectedVariant?.stock === 'number' && Number.isFinite(selectedVariant.stock)
                        ? selectedVariant.stock
                        : null

                    const hasStockLimit = (trackStock ?? true) && stockValue !== null && stockValue >= 0

                    const maxQty = hasStockLimit ? stockValue ?? null : null

                    const clampQty = (next: number) => {
                      if (next < 1) return 1
                      if (typeof maxQty === 'number') return Math.min(maxQty, next)
                      return next
                    }

                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-bold text-gray-900">Quantity</label>
                          {hasStockLimit && typeof stockValue === 'number' && (
                            <span className="text-xs font-medium text-gray-500">
                              Available:{' '}
                              <span className="font-semibold text-gray-800">{stockValue}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            className="rounded-lg border-2 border-gray-300 w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 font-bold text-gray-700"
                            onClick={() => setSelectedProductQty((prev) => clampQty(prev - 1))}
                          >
                            <span className="text-xl">−</span>
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={selectedProductQty}
                            onChange={(e) => {
                              const raw = Number(e.target.value || 1)
                              setSelectedProductQty(clampQty(Number.isFinite(raw) ? raw : 1))
                            }}
                            className="w-28 rounded-lg border-2 border-gray-300 bg-white px-3 py-3 text-center font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button
                            className="rounded-lg border-2 border-gray-300 w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 font-bold text-gray-700"
                            onClick={() => setSelectedProductQty((prev) => clampQty(prev + 1))}
                          >
                            <span className="text-xl">+</span>
                          </button>
                        </div>

                        {hasStockLimit && typeof maxQty === 'number' && selectedProductQty > maxQty && (
                          <p className="text-xs font-medium text-red-600">
                            Quantity cannot exceed available stock ({maxQty}).
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Add to Cart Button */}
                <div className="pt-4 border-t-2 border-gray-200">
                  <button
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white font-bold text-base shadow-lg hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400 active:scale-[0.98]"
                    onClick={() => void confirmAddSelectedProduct()}
                    disabled={selectedProduct.variants.length > 0 && !selectedVariantId}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {memberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 rounded-t-2xl">
              <h4 className="text-xl font-bold text-gray-900">Assign Member</h4>
              <button
                type="button"
                onClick={() => void toggleMemberDropdown()}
                className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="border-b-2 border-gray-200 bg-white p-5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Search by phone, email, member code, name..."
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto">
              {members.map((member) => (
                <button
                  key={member.id}
                  className="block w-full border-b border-gray-100 p-4 text-left transition-all hover:bg-gradient-to-r hover:from-blue-50 hover:to-white last:border-b-0 active:bg-blue-100"
                  onClick={() => {
                    setSelectedMember(member)
                    setMemberOpen(false)
                    setMemberQuery('')
                    focusScanner()
                  }}
                >
                  <div className="flex items-start gap-3">
                    {member.avatar_url ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border-2 border-blue-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={member.avatar_url} alt={member.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full overflow-hidden border-2 border-blue-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/default_user_image.jpg" alt={member.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-base leading-tight">
                        {member.name}
                        {member.phone && <span className="ml-2 text-sm font-normal text-gray-500">({member.phone})</span>}
                      </p>
                      {member.email && (
                        <p className="mt-1.5 text-sm text-gray-600 flex items-center gap-1.5">
                          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {member.email}
                        </p>
                      )}
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}

              {!memberLoading && members.length === 0 && (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">No members found</p>
                  <p className="mt-1 text-xs text-gray-500">Try adjusting your search terms</p>
                </div>
              )}
            </div>

            {members.length > 0 && (
              <div className="flex items-center justify-between border-t-2 border-gray-200 bg-gray-50 px-6 py-4 rounded-b-2xl">
                <span className="text-xs font-medium text-gray-600">Page {memberPage} of {memberLastPage}</span>
                <button
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:bg-white disabled:hover:text-gray-700"
                  disabled={memberLoading || memberPage >= memberLastPage}
                  onClick={() => void fetchMemberPage(memberPage + 1, memberQuery, true)}
                >
                  {memberLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmCashOpen && checkoutMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Confirm Cash Payment
              </h4>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Total Amount</span>
                  <span className="text-lg font-bold text-gray-900">RM {cartTotal.toFixed(2)}</span>
                </div>
                <div className="h-px bg-gray-300"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Cash Received</span>
                  <span className="text-lg font-bold text-blue-700">RM {checkoutMeta.paid_amount.toFixed(2)}</span>
                </div>
                {checkoutMeta.change_amount > 0 && (
                  <>
                    <div className="h-px bg-gray-300"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Change</span>
                      <span className="text-lg font-bold text-green-700">RM {checkoutMeta.change_amount.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 active:scale-95" 
                  onClick={() => setConfirmCashOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-95"
                  onClick={() => {
                    setConfirmCashOpen(false)
                    void finalizeCheckout(checkoutMeta)
                  }}
                >
                  Confirm & Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Success Modal with QR Code */}
      {checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-5 flex items-center justify-between">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Order Completed
              </h4>
              <button
                onClick={() => {
                  setCheckoutResult(null)
                  setQrCodeFullscreen(false)
                  focusScanner()
                }}
                className="rounded-lg p-1.5 text-white/90 transition-all hover:bg-white/20 hover:text-white"
                title="Close"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-gray-600">Order Number</p>
                <p className="text-2xl font-bold text-gray-900">{checkoutResult.order_number}</p>
                <p className="text-lg font-semibold text-gray-700">RM {checkoutResult.total.toFixed(2)}</p>
              </div>

              {checkoutResult.receipt_public_url && (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Scan QR Code to View Receipt</p>
                    <div 
                      className="flex justify-center p-4 bg-white rounded-xl border-2 border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all"
                      onClick={() => setQrCodeFullscreen(true)}
                      title="Click to enlarge QR code"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`}
                        alt="Receipt QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Tap QR code to enlarge for customer scanning</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(checkoutResult.receipt_public_url!, '_blank')}
                      className="flex-1 rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
                    >
                      Open Receipt
                    </button>
                    {/* <button
                      onClick={() => {
                        if (checkoutResult.receipt_public_url) {
                          navigator.clipboard.writeText(checkoutResult.receipt_public_url)
                        }
                      }}
                      className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95"
                      title="Copy receipt link"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button> */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Fullscreen Modal */}
      {qrCodeFullscreen && checkoutResult?.receipt_public_url && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setQrCodeFullscreen(false)}
        >
          <div className="relative">
            {/* <button
              onClick={() => setQrCodeFullscreen(false)}
              className="absolute -top-12 right-0 rounded-full bg-white/20 p-3 text-white transition-all hover:bg-white/30"
              title="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button> */}
            <div className="bg-white p-8 rounded-2xl shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`}
                alt="Receipt QR Code - Fullscreen"
                className="w-80 h-80"
              />
            </div>
            <p className="text-center text-white mt-4 text-sm">Tap anywhere to close</p>
          </div>
        </div>
      )}

      {/* Checkout Error Modal */}
      {checkoutError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
              <h4 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Checkout Failed
              </h4>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">{checkoutError}</p>
              <button
                onClick={() => {
                  setCheckoutError(null)
                  focusScanner()
                }}
                className="w-full rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-gray-700 hover:to-gray-800 hover:shadow-xl active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right Toasts (commercial POS style) */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-40 flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3">
          {toasts.map((toast) => {
            const styles =
              toast.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-900'
                : toast.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : toast.kind === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-blue-200 bg-blue-50 text-blue-900'

            const icon =
              toast.kind === 'success' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : toast.kind === 'error' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : toast.kind === 'warning' ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )

            return (
              <div
                key={toast.id}
                className={`rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${styles}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div className="flex-1 text-sm font-semibold leading-snug">{toast.text}</div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="ml-2 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                    title="Dismiss"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
