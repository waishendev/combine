'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'

type CartItem = {
  id: number
  qty: number
  unit_price: number
  line_total: number
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
  name: string
  sku: string
  barcode: string
  price: number
  thumbnail_url?: string | null
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
}

type PageResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ProductApiItem = {
  id: number
  name?: string
  sku?: string
  price?: number | string
  cover_image_url?: string | null
  variants?: Array<{
    id?: number
    sku?: string | null
    price?: number | string | null
    sale_price?: number | string | null
    image_url?: string | null
    is_active?: boolean | string | number
  }>
}

function extractPaged<T>(json: unknown): PageResponse<T> {
  const payload = typeof json === 'object' && json !== null && "data" in json ? (json as { data?: unknown }).data : undefined

  if (payload && Array.isArray(payload.data)) {
    return {
      data: payload.data as T[],
      current_page: Number(payload.current_page ?? 1),
      last_page: Number(payload.last_page ?? 1),
      per_page: Number(payload.per_page ?? payload.data.length ?? 0),
      total: Number(payload.total ?? payload.data.length ?? 0),
    }
  }

  if (payload && Array.isArray(payload)) {
    return {
      data: payload as T[],
      current_page: 1,
      last_page: 1,
      per_page: payload.length,
      total: payload.length,
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
  const [cart, setCart] = useState<Cart | null>(null)

  const [productOpen, setProductOpen] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productPage, setProductPage] = useState(1)
  const [productLastPage, setProductLastPage] = useState(1)
  const [productLoading, setProductLoading] = useState(false)
  const [productHighlighted, setProductHighlighted] = useState(0)
  const [productInitialLoaded, setProductInitialLoaded] = useState(false)
  const [productSelectModalOpen, setProductSelectModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedProductQty, setSelectedProductQty] = useState(1)

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
      return true
    }

    if (res.status === 404) {
      showMsg('Barcode not found')
      return false
    }

    showMsg(json?.message ?? 'Unable to add item.')
    return false
  }

  async function fetchProductPage(page: number, keyword: string, append: boolean) {
    setProductLoading(true)

    let mapped: ProductOption[] = []
    let currentPage = page
    let lastPage = page

    if (keyword.trim()) {
      const res = await fetch(`/api/proxy/pos/products/search?q=${encodeURIComponent(keyword.trim())}&page=${page}&per_page=100`)
      const json = await res.json()
      const paged = extractPaged<ProductOption>(json)
      mapped = paged.data
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
        .map((item): ProductOption | null => {
          const activeVariant = Array.isArray(item.variants)
            ? item.variants.find((v) => v && (v.is_active === true || v.is_active === '1' || v.is_active === 1 || v.is_active === 'true')) ?? item.variants[0]
            : null

          const sku = activeVariant?.sku || item.sku || ''
          if (!sku) return null

          const priceRaw = activeVariant?.sale_price ?? activeVariant?.price ?? item.price ?? 0
          const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw || 0)

          return {
            id: Number(activeVariant?.id ?? item.id),
            name: item.name ?? '-',
            sku,
            barcode: sku,
            price: Number.isFinite(price) ? price : 0,
            thumbnail_url: activeVariant?.image_url ?? item.cover_image_url ?? null,
          }
        })
        .filter((item): item is ProductOption => Boolean(item))

      currentPage = paged.current_page
      lastPage = paged.last_page
    }

    setProducts((prev) => (append ? [...prev, ...mapped] : mapped))
    setProductPage(currentPage)
    setProductLastPage(lastPage)
    setProductHighlighted(0)
    setProductLoading(false)
  }

  async function fetchMemberPage(page: number, keyword: string, append: boolean) {
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
  }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart()
  }, [])

  useEffect(() => {
    if (!productOpen) return

    const handle = setTimeout(() => {
      void fetchProductPage(1, productQuery, false)
    }, 300)

    return () => clearTimeout(handle)
  }, [productQuery, productOpen])

  useEffect(() => {
    if (!memberOpen) return

    const handle = setTimeout(() => {
      void fetchMemberPage(1, memberQuery, false)
    }, 300)

    return () => clearTimeout(handle)
  }, [memberQuery, memberOpen])

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
    setSelectedProduct(item)
    setSelectedProductQty(1)
    setProductSelectModalOpen(true)
  }

  const confirmAddSelectedProduct = async () => {
    if (!selectedProduct) return

    const identifier = (selectedProduct.barcode || selectedProduct.sku || '').trim()
    if (!identifier) {
      showMsg('Selected product has no barcode/SKU for POS add.')
      return
    }

    const success = await addByBarcode(identifier, selectedProductQty)
    if (!success) return

    setProductSelectModalOpen(false)
    setSelectedProduct(null)
    setProductOpen(false)
    setProductQuery('')
    focusScanner()
  }

  const quickAddProduct = async (item: ProductOption) => {
    const identifier = (item.barcode || item.sku || '').trim()
    if (!identifier) {
      showMsg('This product cannot be added because barcode/SKU is missing.')
      return
    }

    await addByBarcode(identifier, 1)
  }

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

  const toggleProductDropdown = async () => {
    if (productOpen) {
      setProductOpen(false)
      return
    }

    setProductOpen(true)
    if (!productInitialLoaded) {
      setProductInitialLoaded(true)
      await fetchProductPage(1, '', false)
    }
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

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold">POS Checkout</h2>
      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm">
            <label className="mb-2 block text-sm font-medium text-blue-800">Scanner ready</label>
            <p className="text-sm text-blue-700">Scanner listens in background. Just scan the product barcode directly.</p>
            <input
              ref={scannerInputRef}
              className="sr-only"
              placeholder="Scan barcode and press Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onScannerEnter()
                }
              }}
            />
            <p className="mt-1 text-xs text-blue-700/80">Manual typing input is hidden to reduce clutter.</p>
          </div>

          <div className="rounded-xl border p-4 shadow-sm">
            <label className="mb-2 block text-sm font-medium">Select product (manual fallback)</label>
            <button onClick={() => void toggleProductDropdown()} className="mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50">
              {productOpen ? 'Hide product browser' : 'Open product browser'}
            </button>

            {productOpen && (
              <div className="rounded-lg border bg-white">
                <div className="border-b p-2">
                  <input
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Type to search product (debounced 300ms)"
                  />
                </div>

                <div className="grid max-h-[32rem] grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-2">
                  {products.map((item, idx) => (
                    <button
                      key={`${item.id}-${idx}`}
                      className={`overflow-hidden rounded-lg border text-left text-sm ${idx === productHighlighted ? 'border-black bg-gray-100' : 'hover:bg-gray-50'}`}
                      onMouseEnter={() => setProductHighlighted(idx)}
                      onClick={() => void onSelectProduct(item)}
                    >
                      <div className="aspect-square w-full bg-gray-100">
                        {item.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnail_url} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">No image</div>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.sku || item.barcode}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="block font-semibold">RM {Number(item.price ?? 0).toFixed(2)}</span>
                          <button
                            type="button"
                            className="rounded bg-black px-2 py-1 text-xs text-white"
                            onClick={(e) => {
                              e.stopPropagation()
                              void quickAddProduct(item)
                            }}
                          >
                            Add 1x
                          </button>
                        </div>
                      </div>
                    </button>
                  ))}

                  {!productLoading && products.length === 0 && <p className="p-4 text-sm text-gray-500">No products found.</p>}
                </div>

                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-gray-500">Page {productPage} / {productLastPage}</span>
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                    disabled={productLoading || productPage >= productLastPage}
                    onClick={() => void fetchProductPage(productPage + 1, productQuery, true)}
                  >
                    {productLoading ? 'Loading...' : 'See more'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">Member assignment (optional)</h3>
            <button onClick={() => void toggleMemberDropdown()} className="mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50">
              {memberOpen ? 'Hide member search' : 'Open member search'}
            </button>

            {memberOpen && (
              <div className="rounded-lg border bg-white">
                <div className="border-b p-2">
                  <input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Search by phone, email, member code, name"
                  />
                </div>

                <div className="max-h-72 overflow-auto">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      className="block w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-gray-50"
                      onClick={() => {
                        setSelectedMember(member)
                        setMemberOpen(false)
                        focusScanner()
                      }}
                    >
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.phone ?? '-'} · {member.email ?? '-'}</p>
                    </button>
                  ))}

                  {!memberLoading && members.length === 0 && <p className="p-4 text-sm text-gray-500">No members found.</p>}
                </div>

                <div className="flex items-center justify-between border-t p-2">
                  <span className="text-xs text-gray-500">Page {memberPage} / {memberLastPage}</span>
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                    disabled={memberLoading || memberPage >= memberLastPage}
                    onClick={() => void fetchMemberPage(memberPage + 1, memberQuery, true)}
                  >
                    {memberLoading ? 'Loading...' : 'See more'}
                  </button>
                </div>
              </div>
            )}

            {selectedMember && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-green-50 p-2 text-sm text-green-800">
                <span>Selected: {selectedMember.name}</span>
                <button onClick={() => setSelectedMember(null)} className="underline">Clear / Unassign</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xl border p-4 shadow-sm lg:sticky lg:top-5">
            <h3 className="mb-3 text-lg font-semibold">Cart Summary</h3>

            <div className="space-y-2">
              {cart?.items.length ? (
                cart.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.variant_name} · {item.variant_sku}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => void updateQty(item.id, item.qty - 1)} className="rounded border px-2">-</button>
                        <span className="text-sm">{item.qty}</span>
                        <button onClick={() => void updateQty(item.id, item.qty + 1)} className="rounded border px-2">+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">RM {Number(item.line_total).toFixed(2)}</span>
                        <button onClick={() => void removeItem(item.id)} className="text-red-600">✕</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
                  <div className="mb-2 text-2xl">🛒</div>
                  <p>Cart is empty</p>
                  <p className="text-xs">Scan or search to add items</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>RM {cartSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>RM {discount.toFixed(2)}</span></div>
              <div className="flex justify-between text-base font-semibold"><span>Total</span><span>RM {cartTotal.toFixed(2)}</span></div>
            </div>

            <div className="mt-4 rounded-lg border p-3">
              <h4 className="mb-2 text-sm font-semibold">Payment method</h4>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /> CASH</label>
                <label className="flex items-center gap-2"><input type="radio" checked={paymentMethod === 'qrpay'} onChange={() => setPaymentMethod('qrpay')} /> QRPAY</label>
              </div>
              {paymentMethod === 'cash' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-gray-600">Cash received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-600">Change: RM {cashChange.toFixed(2)}</p>
                </div>
              )}
              {paymentMethod === 'qrpay' && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-700">Choose how to attach QR payment proof:</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" className="rounded border px-2 py-2 text-xs hover:bg-gray-50" onClick={() => qrUploadInputRef.current?.click()}>
                      Upload Existing
                    </button>
                    <button type="button" className="rounded border px-2 py-2 text-xs hover:bg-gray-50" onClick={() => qrCameraBackInputRef.current?.click()}>
                      Take Photo (Back Cam)
                    </button>
                    <button type="button" className="rounded border px-2 py-2 text-xs hover:bg-gray-50" onClick={() => qrCameraFrontInputRef.current?.click()}>
                      Take Photo (Front Cam)
                    </button>
                  </div>
                  <input ref={qrUploadInputRef} type="file" accept="image/*" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraBackInputRef} type="file" accept="image/*" capture="environment" onChange={onSelectQrProof} className="sr-only" />
                  <input ref={qrCameraFrontInputRef} type="file" accept="image/*" capture="user" onChange={onSelectQrProof} className="sr-only" />
                  {qrProofFileName && (
                    <div className="flex items-center justify-between rounded border bg-gray-50 px-2 py-1">
                      <p className="truncate pr-2 text-xs text-gray-600">Selected: {qrProofFileName}</p>
                      <button type="button" className="text-xs text-red-600 underline" onClick={clearQrProof}>Clear</button>
                    </div>
                  )}
                  {qrProofPreviewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrProofPreviewUrl} alt="QR payment proof" className="max-h-40 w-full rounded border object-contain" />
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => void checkout()}
              disabled={checkingOut || !cart?.items.length}
              className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkingOut ? 'Processing...' : 'Checkout'}
            </button>

            {checkoutResult && (
              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <h3 className="text-sm font-semibold">Order completed</h3>
                <p className="text-sm">Order No: {checkoutResult.order_number}</p>
                <p className="text-sm">Total: RM {checkoutResult.total.toFixed(2)}</p>
                <p className="text-sm">Paid: RM {checkoutResult.paid_amount.toFixed(2)}</p>
                <p className="text-sm">Change: RM {checkoutResult.change_amount.toFixed(2)}</p>
                {checkoutResult.receipt_public_url && (
                  <>
                    <div className="mt-2 rounded border bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`}
                        alt="Receipt QR code"
                        className="mx-auto h-40 w-40"
                      />
                    </div>
                    <a href={checkoutResult.receipt_public_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-blue-600 underline">
                      {checkoutResult.receipt_public_url}
                    </a>
                  </>
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-500">Items: {totalItems}</p>
          </div>
        </div>
      </div>

      {productSelectModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h4 className="text-lg font-semibold">Add product to cart</h4>
            <p className="mt-1 text-sm font-medium">{selectedProduct.name}</p>
            <p className="text-xs text-gray-500">{selectedProduct.sku || selectedProduct.barcode}</p>
            <p className="mt-1 text-sm">RM {Number(selectedProduct.price ?? 0).toFixed(2)}</p>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Quantity</label>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border px-3 py-1"
                  onClick={() => setSelectedProductQty((prev) => Math.max(1, prev - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  value={selectedProductQty}
                  onChange={(e) => setSelectedProductQty(Math.max(1, Number(e.target.value || 1)))}
                  className="w-24 rounded border px-2 py-1 text-center"
                />
                <button
                  className="rounded border px-3 py-1"
                  onClick={() => setSelectedProductQty((prev) => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setProductSelectModalOpen(false)
                  setSelectedProduct(null)
                }}
              >
                Cancel
              </button>
              <button className="rounded bg-black px-3 py-2 text-sm text-white" onClick={() => void confirmAddSelectedProduct()}>
                Add to cart
              </button>
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
