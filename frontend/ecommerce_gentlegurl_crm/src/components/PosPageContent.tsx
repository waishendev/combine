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

type LastAction = {
  type: 'success' | 'error' | 'info'
  text: string
}

type Member = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  member_code?: string | null
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

  const [message, setMessage] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<LastAction>({ type: 'info', text: 'Ready to scan' })
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

  const totalItems = useMemo(() => cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0, [cart])
  const cartSubtotal = Number(cart?.subtotal ?? cart?.grand_total ?? 0)
  const cartTotal = Number(cart?.grand_total ?? 0)
  const discount = Math.max(0, cartSubtotal - cartTotal)

  const focusScanner = () => {
    scannerInputRef.current?.focus()
  }

  const clearScannerInput = () => {
    if (scannerInputRef.current) {
      scannerInputRef.current.value = ''
    }
  }

  const showMsg = (text: string) => setMessage(text)

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
      showMsg('Item added to POS cart.')
      setLastAction({ type: 'success', text: '✅ Added item to cart' })
      return true
    }

    if (res.status === 404) {
      showMsg('Barcode not found')
      setLastAction({ type: 'error', text: `❌ Not found: ${trimmed}` })
      return false
    }

    showMsg(json?.message ?? 'Unable to add item.')
    setLastAction({ type: 'error', text: `❌ Unable to add: ${trimmed}` })
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
      showMsg('Item added to POS cart.')
      setLastAction({ type: 'success', text: '✅ Added item to cart' })
      return true
    }

    showMsg(json?.message ?? 'Unable to add selected product.')
    setLastAction({ type: 'error', text: '❌ Selected product unavailable' })
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
      setLastAction({ type: 'info', text: 'Quantity updated' })
    }
  }

  const removeItem = async (itemId: number) => {
    if (!window.confirm('Remove this item from cart?')) return
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
      setLastAction({ type: 'info', text: 'Item removed from cart' })
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
      showMsg('Invalid product ID.')
      return
    }

    await addBySelection({ product_id: productId }, 1)
    focusScanner()
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
      body: JSON.stringify({ variant_id: variantId }),
    })
    const json = await res.json()

    if (!res.ok) {
      showMsg(json?.message ?? 'Unable to change variant.')
      return
    }

    setCart(json.data.cart)
    showMsg('Variant updated.')
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

  const finalizeCheckout = async (meta: CheckoutMeta) => {
    if (!cart || cart.items.length === 0 || checkingOut) return

    setCheckingOut(true)
    setMessage(null)

    const res = await fetch('/api/proxy/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: paymentMethod, member_id: selectedMember?.id ?? null }),
    })
    const json = await res.json()

    if (!res.ok) {
      showMsg(json?.message ?? 'Checkout failed.')
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
    showMsg('Checkout successful.')
    setLastAction({ type: 'success', text: '✅ Checkout completed' })
    setCheckingOut(false)
    focusScanner()
  }

  const checkout = async () => {
    if (!cart || cart.items.length === 0 || checkingOut) return

    if (paymentMethod === 'qrpay') {
      if (!qrProofFileName) {
        showMsg('Please upload QR payment proof before checkout.')
        return
      }

      await finalizeCheckout({ paid_amount: cartTotal, change_amount: 0 })
      return
    }

    if (!Number.isFinite(cashReceivedAmount) || cashReceivedAmount < cartTotal) {
      showMsg('Cash received must be equal or more than total.')
      return
    }

    setCheckoutMeta({ paid_amount: cashReceivedAmount, change_amount: cashChange })
    setConfirmCashOpen(true)
  }

  const toggleMemberDropdown = async () => {
    if (memberOpen) {
      setMemberOpen(false)
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


  const lastActionStyles: Record<LastAction['type'], string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-slate-200 bg-slate-50 text-slate-600',
  }

  const canCheckout = Boolean(cart?.items.length) && !checkingOut

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4 lg:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">POS Checkout</h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-lg font-semibold">Scan barcode</label>
        <input
          ref={scannerInputRef}
          type="text"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onScannerEnter()
            }
          }}
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-lg font-medium focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
          placeholder="Scan barcode and press Enter"
          autoFocus
        />
        <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${lastActionStyles[lastAction.type]}`}>{lastAction.text}</p>
        {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Products</h3>
            <p className="mt-1 text-sm text-slate-500">Search and add quickly. Use Enter on selected card.</p>
            <div className="mt-4">
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (!products.length) return
                  const cols = 4
                  if (e.key === 'ArrowRight') {
                    e.preventDefault(); setProductHighlighted((prev) => Math.min(products.length - 1, prev + 1))
                  }
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault(); setProductHighlighted((prev) => Math.max(0, prev - 1))
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault(); setProductHighlighted((prev) => Math.min(products.length - 1, prev + cols))
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault(); setProductHighlighted((prev) => Math.max(0, prev - cols))
                  }
                  if (e.key === 'Enter' && products[productHighlighted]) {
                    e.preventDefault(); void onSelectProduct(products[productHighlighted])
                  }
                }}
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Search products by name, SKU, or barcode..."
              />
            </div>

            <div className="mt-4 grid max-h-[calc(100vh-20rem)] grid-cols-2 gap-4 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
              {productLoading && products.length === 0 && Array.from({ length: 8 }).map((_, idx) => (
                <div key={`sk-${idx}`} className="h-[250px] animate-pulse rounded-xl border border-slate-200 p-3">
                  <div className="aspect-square rounded-lg bg-slate-100" />
                  <div className="mt-3 h-4 rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
                  <div className="mt-4 h-9 rounded bg-slate-100" />
                </div>
              ))}

              {!productLoading && products.map((item, idx) => (
                <div
                  key={item.product_id}
                  role="button"
                  tabIndex={0}
                  className={`flex h-[250px] flex-col overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition ${idx === productHighlighted ? 'border-black' : 'border-slate-200 hover:border-slate-400'}`}
                  onMouseEnter={() => setProductHighlighted(idx)}
                  onClick={() => void onSelectProduct(item)}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400"><span className="text-lg">🖼️</span><span className="text-xs">No image</span></div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.sku || item.barcode}</p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="text-sm font-semibold">RM {Number(item.price ?? 0).toFixed(2)}</span>
                      <button
                        type="button"
                        className="h-9 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          void quickAddProduct(item)
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!productLoading && products.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-12 text-center">
                  <div className="text-3xl">📦</div>
                  <p className="mt-2 text-sm font-semibold">No products found</p>
                  <p className="text-sm text-slate-500">Try a different keyword.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2 lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Member</h3>
            <p className="mt-1 text-sm text-slate-500">Optional for member pricing and receipt tracking.</p>
            {selectedMember ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold">{selectedMember.name}</p>
                <p className="text-xs text-emerald-700">{selectedMember.phone ?? '-'} · {selectedMember.email ?? '-'}</p>
                <button onClick={() => setSelectedMember(null)} className="mt-2 text-xs font-medium text-emerald-700 underline">Clear member</button>
              </div>
            ) : (
              <button onClick={() => void toggleMemberDropdown()} className="mt-3 h-11 w-full rounded-xl border border-slate-300 px-4 text-left text-sm hover:bg-slate-50">
                {memberOpen ? 'Hide member search' : 'Search member'}
              </button>
            )}
            {memberOpen && (
              <div className="mt-3 rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 p-3"><input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-black focus:outline-none" placeholder="Search member..." autoFocus /></div>
                <div className="max-h-56 overflow-auto">
                  {members.map((member) => (
                    <button key={member.id} className="block w-full border-b border-slate-100 p-3 text-left last:border-b-0 hover:bg-slate-50" onClick={() => { setSelectedMember(member); setMemberOpen(false); focusScanner() }}>
                      <p className="text-sm font-semibold">{member.name}</p>
                      <p className="text-xs text-slate-500">{member.phone ?? '-'} · {member.email ?? '-'}</p>
                    </button>
                  ))}
                  {!memberLoading && members.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No members found</div>}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold">Cart</h3>
            {cart?.items.length ? (
              <div className="mt-3 space-y-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold">{item.product_name}</p>
                        <p className="text-xs text-slate-500">{item.variant_name || item.variant_sku || 'Single product'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => void updateQty(item.id, item.qty - 1)} className="h-8 w-8 rounded-lg border border-slate-300">-</button>
                        <span className="w-6 text-center text-sm">{item.qty}</span>
                        <button onClick={() => void updateQty(item.id, item.qty + 1)} className="h-8 w-8 rounded-lg border border-slate-300">+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="min-w-[90px] text-right text-sm font-semibold">RM {Number(item.line_total).toFixed(2)}</span>
                        <button onClick={() => void removeItem(item.id)} className="text-sm text-red-600">Remove</button>
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
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <div className="text-3xl">🛒</div>
                <p className="mt-2 text-sm font-semibold">Cart is empty</p>
                <p className="text-sm text-slate-500">Scan or add products to start</p>
              </div>
            )}

            <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>RM {cartSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>RM {discount.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>RM {cartTotal.toFixed(2)}</span></div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <h4 className="text-lg font-semibold">Payment</h4>
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><span>Cash</span><input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /></label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><span>QRPay</span><input type="radio" checked={paymentMethod === 'qrpay'} onChange={() => setPaymentMethod('qrpay')} /></label>
                {paymentMethod === 'qrpay' && <p className="text-xs text-slate-500">Customer transfers, staff confirms received.</p>}
              </div>
              {paymentMethod === 'cash' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-sm font-medium">Cash received</label>
                  <input type="number" min="0" step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" placeholder="0.00" />
                  <p className="text-xs text-slate-500">Change: RM {cashChange.toFixed(2)}</p>
                </div>
              )}
              {paymentMethod === 'qrpay' && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="h-10 rounded-lg border border-slate-300 px-2 text-xs hover:bg-slate-50" onClick={() => qrUploadInputRef.current?.click()}>Upload Existing</button>
                    <button type="button" className="h-10 rounded-lg border border-slate-300 px-2 text-xs hover:bg-slate-50" onClick={() => qrCameraBackInputRef.current?.click()}>Take Photo (Back)</button>
                    <button type="button" className="h-10 rounded-lg border border-slate-300 px-2 text-xs hover:bg-slate-50" onClick={() => qrCameraFrontInputRef.current?.click()}>Take Photo (Front)</button>
                  </div>
                  <input ref={qrUploadInputRef} type="file" accept="image/*" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectQrProof} className="sr-only" />
                  {qrProofFileName && <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"><p className="truncate pr-2 text-xs text-slate-600">Selected: {qrProofFileName}</p><button type="button" className="text-xs text-red-600 underline" onClick={clearQrProof}>Clear</button></div>}
                </div>
              )}
            </div>

            <button onClick={() => void checkout()} disabled={!canCheckout} className="mt-4 h-12 w-full rounded-xl bg-black text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{checkingOut ? 'Processing checkout...' : 'Checkout'}</button>

            {checkoutResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-sm font-semibold">Order completed</h3>
                <p className="text-sm">Order No: {checkoutResult.order_number}</p>
                <p className="text-sm">Total: RM {checkoutResult.total.toFixed(2)}</p>
              </div>
            )}

            <p className="mt-3 text-sm text-slate-500">Items: {totalItems}</p>
          </div>
        </div>
      </div>

      {productSelectModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4">
              <h4 className="text-xl font-semibold">Product Details</h4>
              <button
                onClick={() => {
                  setProductSelectModalOpen(false)
                  setSelectedProduct(null)
                  setSelectedVariantId(null)
                  setProductVariantLoading(false)
                  setFullProductData(null)
                }}
                className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              {/* Left: Product Images */}
              <div className="space-y-4">
                {productVariantLoading ? (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-gray-500">Loading...</p>
                  </div>
                ) : (
                  <>
                    {fullProductData?.images?.[0]?.url || fullProductData?.cover_image_url || selectedProduct.thumbnail_url ? (
                      <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fullProductData?.images?.[0]?.url || fullProductData?.cover_image_url || selectedProduct.thumbnail_url || ''}
                          alt={selectedProduct.name || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square w-full bg-gray-100 rounded-lg flex items-center justify-center">
                        <p className="text-sm text-gray-400">No image</p>
                      </div>
                    )}
                    {fullProductData?.images && fullProductData.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {fullProductData.images.slice(0, 4).map((img: any, idx: number) => (
                          <div key={idx} className="aspect-square bg-gray-100 rounded overflow-hidden">
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
              <div className="space-y-4">
                <div>
                  <h1 className="text-2xl font-semibold">{selectedProduct.name}</h1>
                  <p className="text-sm text-gray-500 mt-1">{selectedProduct.sku || selectedProduct.barcode}</p>
                </div>

                {/* Price */}
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-black">
                      RM {selectedVariantId && selectedProduct.variants.length > 0
                        ? Number(selectedProduct.variants.find(v => v.id === selectedVariantId)?.price ?? selectedProduct.price ?? 0).toFixed(2)
                        : Number(selectedProduct.price ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Variants */}
                {productVariantLoading ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-gray-500">Loading variants...</p>
                  </div>
                ) : selectedProduct.variants.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold">Select Variant</label>
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
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
                            className={`rounded-lg border-2 p-3 text-left transition-all ${
                              selected
                                ? 'border-black bg-gray-100'
                                : !isActive || outOfStock
                                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{variant.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{variant.sku}</p>
                                <p className="text-sm font-semibold mt-1">RM {variant.price.toFixed(2)}</p>
                              </div>
                              {outOfStock && (
                                <span className="text-xs text-red-600 font-medium">Out of Stock</span>
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

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      className="rounded-lg border-2 border-gray-300 w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedProductQty((prev) => Math.max(1, prev - 1))}
                    >
                      <span className="text-lg">−</span>
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={selectedProductQty}
                      onChange={(e) => setSelectedProductQty(Math.max(1, Number(e.target.value || 1)))}
                      className="w-24 rounded-lg border-2 border-gray-300 px-3 py-2 text-center font-semibold"
                    />
                    <button
                      className="rounded-lg border-2 border-gray-300 w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedProductQty((prev) => prev + 1)}
                    >
                      <span className="text-lg">+</span>
                    </button>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <div className="pt-4 border-t">
                  <button
                    className="w-full rounded-lg bg-black px-6 py-3 text-white font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {confirmCashOpen && checkoutMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-lg font-semibold">Confirm cash payment</h4>
            <div className="mt-3 space-y-1 text-sm">
              <p>Total: RM {cartTotal.toFixed(2)}</p>
              <p>Customer paid: RM {checkoutMeta.paid_amount.toFixed(2)}</p>
              <p>Change: RM {checkoutMeta.change_amount.toFixed(2)}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => setConfirmCashOpen(false)}>Cancel</button>
              <button
                className="rounded bg-black px-3 py-2 text-sm text-white"
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
      )}

    </div>
  )
}
