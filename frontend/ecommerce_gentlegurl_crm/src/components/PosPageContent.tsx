'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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

type Member = {
  id: number
  name: string
  phone?: string | null
  member_code?: string | null
}

type ProductSearchItem = {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  thumbnail_url?: string | null
}

export default function PosPageContent() {
  const productInputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qrpay'>('cash')
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [searchResults, setSearchResults] = useState<ProductSearchItem[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<null | {
    order_number: string
    receipt_public_url: string | null
    total: number
  }>(null)

  const totalItems = useMemo(() => cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0, [cart])
  const cartSubtotal = Number(cart?.subtotal ?? cart?.grand_total ?? 0)
  const cartTotal = Number(cart?.grand_total ?? 0)
  const discount = Math.max(0, cartSubtotal - cartTotal)

  async function loadCart() {
    const res = await fetch('/api/proxy/pos/cart', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
    }
  }

  async function searchProducts(keyword: string) {
    const res = await fetch(`/api/proxy/pos/products/search?q=${encodeURIComponent(keyword)}`)
    const json = await res.json()
    if (res.ok) {
      const items = (json.data ?? []) as ProductSearchItem[]
      setSearchResults(items)
      setHighlightedIndex(0)
    }
  }

  async function addByBarcode(barcode: string) {
    const res = await fetch('/api/proxy/pos/cart/add-by-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode.trim(), qty: 1 }),
    })
    const json = await res.json()

    if (res.ok) {
      setCart(json.data.cart)
      setMessage('Item added to POS cart.')
      setQuery('')
      setSearchResults([])
      setHighlightedIndex(0)
      productInputRef.current?.focus()
      return true
    }

    if (res.status === 404) {
      return false
    }

    setMessage(json?.message ?? 'Unable to add item.')
    return true
  }

  async function addBySelectedSearchItem(item: ProductSearchItem) {
    const ok = await addByBarcode(item.sku)
    if (!ok) {
      setMessage('Product not found')
    }
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

  async function searchMembers(keyword: string) {
    const res = await fetch(`/api/proxy/pos/members/search?q=${encodeURIComponent(keyword)}`)
    const json = await res.json()
    if (res.ok) {
      setMembers(json.data ?? [])
    }
  }

  useEffect(() => {
    productInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart()
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      const value = query.trim()
      if (value.length < 2) {
        setSearchResults([])
        setHighlightedIndex(0)
        return
      }
      void searchProducts(value)
    }, 250)

    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    const handle = setTimeout(() => {
      const value = memberQuery.trim()
      if (value.length < 2) {
        setMembers([])
        return
      }
      void searchMembers(value)
    }, 300)

    return () => clearTimeout(handle)
  }, [memberQuery])

  const onPressEnter = async () => {
    const value = query.trim()
    if (!value || loading) return

    setLoading(true)
    setMessage(null)

    const consumed = await addByBarcode(value)
    if (!consumed) {
      const highlighted = searchResults[highlightedIndex] ?? searchResults[0]
      if (highlighted) {
        await addBySelectedSearchItem(highlighted)
      } else {
        setMessage('Product not found')
      }
    }

    setLoading(false)
  }

  const checkout = async () => {
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
      setMessage(json?.message ?? 'Checkout failed.')
      setCheckingOut(false)
      return
    }

    setCheckoutResult({
      order_number: json.data.order.order_number,
      receipt_public_url: json.data.receipt_public_url,
      total: Number(json.data.order.grand_total ?? 0),
    })
    setSelectedMember(null)
    setMembers([])
    setMemberQuery('')
    setCart({ id: cart.id, items: [], subtotal: 0, grand_total: 0 })
    setMessage('Checkout successful.')
    setCheckingOut(false)
    productInputRef.current?.focus()
  }

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold">POS Checkout</h2>
      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="rounded-xl border p-4 shadow-sm">
            <label className="mb-2 block text-sm font-medium">Scan / Search product</label>
            <div className="flex gap-2">
              <input
                ref={productInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(0, searchResults.length - 1)))
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0))
                    return
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onPressEnter()
                  }
                }}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="Scan barcode OR type name/SKU then press Enter"
              />
              <button onClick={() => setBrowseOpen(true)} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Browse products</button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-72 overflow-auto rounded-lg border bg-white">
                {searchResults.map((item, idx) => (
                  <button
                    key={item.id}
                    className={`flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-b-0 ${idx === highlightedIndex ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => void addBySelectedSearchItem(item)}
                  >
                    <div className="flex items-center gap-3">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">No img</div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.sku || item.barcode}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold">RM {Number(item.price ?? 0).toFixed(2)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold">Member assignment (optional)</h3>
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Search by phone, member code, name"
            />
            <div className="mt-3 space-y-2">
              {members.map((member) => (
                <button key={member.id} className="block w-full rounded-lg border p-2 text-left hover:bg-gray-50" onClick={() => setSelectedMember(member)}>
                  {member.name} ({member.phone ?? '-'})
                </button>
              ))}
            </div>
            {selectedMember && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-green-50 p-2 text-sm text-green-800">
                <span>Selected: {selectedMember.name}</span>
                <button onClick={() => setSelectedMember(null)} className="underline">Clear</button>
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
              {paymentMethod === 'qrpay' && <p className="mt-2 text-xs text-amber-700">Customer transfers by QR, staff confirms received.</p>}
            </div>

            <button
              onClick={() => void checkout()}
              disabled={checkingOut || loading || !cart?.items.length}
              className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkingOut ? 'Processing...' : 'Checkout'}
            </button>

            {checkoutResult && (
              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <h3 className="text-sm font-semibold">Order completed</h3>
                <p className="text-sm">Order No: {checkoutResult.order_number}</p>
                <p className="text-sm">Total: RM {checkoutResult.total.toFixed(2)}</p>
                {checkoutResult.receipt_public_url && (
                  <div className="mt-2">
                    <p className="text-xs font-medium">Guest Receipt QR</p>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`}
                      alt="Guest receipt QR"
                      className="mt-2 h-40 w-40"
                    />
                    <a href={checkoutResult.receipt_public_url} target="_blank" rel="noreferrer" className="block break-all text-xs text-blue-600 underline">
                      {checkoutResult.receipt_public_url}
                    </a>
                  </div>
                )}
              </div>
            )}

            <p className="mt-2 text-xs text-gray-500">Items: {totalItems}</p>
          </div>
        </div>
      </div>

      {browseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Browse products</h3>
              <button onClick={() => setBrowseOpen(false)} className="rounded border px-2 py-1 text-sm">Close</button>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-3 w-full rounded-lg border px-3 py-2"
              placeholder="Search products..."
            />
            <div className="max-h-[55vh] overflow-auto rounded-lg border">
              {searchResults.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Type at least 2 characters to search.</p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={`browse-${item.id}`}
                    className="flex w-full items-center justify-between border-b p-3 text-left last:border-b-0 hover:bg-gray-50"
                    onClick={() => {
                      void addBySelectedSearchItem(item)
                      setBrowseOpen(false)
                    }}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </div>
                    <span className="text-sm font-semibold">RM {Number(item.price ?? 0).toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
