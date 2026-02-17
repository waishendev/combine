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

export default function PosPageContent() {
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)
  const [barcode, setBarcode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qrpay'>('cash')
  const [loading, setLoading] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<null | {
    order_number: string
    receipt_public_url: string | null
    total: number
  }>(null)
  const totalItems = useMemo(
    () => cart?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0,
    [cart]
  )

  async function loadCart() {
    const res = await fetch('/api/proxy/pos/cart', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok && json?.data?.cart) {
      setCart(json.data.cart)
    }
  }

  const addByBarcode = async () => {
    if (!barcode.trim()) return

    setLoading(true)
    setMessage(null)
    const res = await fetch('/api/proxy/pos/cart/add-by-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcode.trim(), qty: 1 }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMessage(json?.message ?? 'Failed to add barcode.')
    } else {
      setCart(json.data.cart)
      setMessage('Item added to POS cart.')
      setBarcode('')
      barcodeInputRef.current?.focus()
    }
    setLoading(false)
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
    const res = await fetch(`/api/proxy/pos/cart/items/${itemId}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (res.ok) {
      setCart(json.data.cart)
    }
  }

  async function searchMembers(query: string) {
    const res = await fetch(`/api/proxy/pos/members/search?q=${encodeURIComponent(query)}`)
    const json = await res.json()
    if (res.ok) {
      setMembers(json.data ?? [])
    }
  }


  useEffect(() => {
    barcodeInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCart()
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      if (memberQuery.trim().length < 2) {
        setMembers([])
        return
      }
      void searchMembers(memberQuery.trim())
    }, 300)

    return () => clearTimeout(handle)
  }, [memberQuery])

  const checkout = async () => {
    if (!cart || cart.items.length === 0 || checkingOut) return

    setCheckingOut(true)
    setMessage(null)
    const res = await fetch('/api/proxy/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_method: paymentMethod,
        member_id: selectedMember?.id ?? null,
      }),
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
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold">POS Checkout</h2>

      {message && <div className="rounded bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}

      <div className="rounded border p-4">
        <label className="mb-2 block text-sm font-medium">Barcode scan input</label>
        <input
          ref={barcodeInputRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addByBarcode()
            }
          }}
          className="w-full rounded border px-3 py-2"
          placeholder="Scan barcode then press Enter"
        />
        <p className="mt-2 text-xs text-gray-500">Auto-focused for hardware scanner usage.</p>
      </div>

      <div className="rounded border p-4">
        <h3 className="mb-3 text-lg font-semibold">Cart ({totalItems} items)</h3>
        <div className="space-y-2">
          {cart?.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-xs text-gray-500">{item.variant_name} · {item.variant_sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => void updateQty(item.id, item.qty - 1)} className="rounded border px-2">-</button>
                <span>{item.qty}</span>
                <button onClick={() => void updateQty(item.id, item.qty + 1)} className="rounded border px-2">+</button>
                <button onClick={() => void removeItem(item.id)} className="rounded border px-2 text-red-600">Remove</button>
              </div>
            </div>
          ))}
          {!cart?.items.length && <p className="text-sm text-gray-500">No items in cart.</p>}
        </div>
        <div className="mt-3 text-right font-semibold">Total: RM {Number(cart?.grand_total ?? 0).toFixed(2)}</div>
      </div>

      <div className="rounded border p-4">
        <h3 className="mb-3 text-lg font-semibold">Member assignment (optional)</h3>
        <input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Search by phone, member code, name"
        />
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <button
              key={member.id}
              className="block w-full rounded border p-2 text-left hover:bg-gray-50"
              onClick={() => setSelectedMember(member)}
            >
              {member.name} ({member.phone ?? '-'})
            </button>
          ))}
        </div>
        {selectedMember && (
          <div className="mt-3 flex items-center justify-between rounded bg-green-50 p-2 text-sm text-green-800">
            <span>Selected: {selectedMember.name}</span>
            <button onClick={() => setSelectedMember(null)} className="underline">Clear</button>
          </div>
        )}
      </div>

      <div className="rounded border p-4">
        <h3 className="mb-3 text-lg font-semibold">Payment method</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} /> CASH
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={paymentMethod === 'qrpay'} onChange={() => setPaymentMethod('qrpay')} /> QRPAY
          </label>
        </div>
        {paymentMethod === 'qrpay' && (
          <p className="mt-2 text-sm text-amber-700">Customer transfers by QR, staff confirms received.</p>
        )}
      </div>

      <button
        onClick={() => void checkout()}
        disabled={checkingOut || loading || !cart?.items.length}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {checkingOut ? 'Processing...' : 'Checkout'}
      </button>

      {checkoutResult && (
        <div className="rounded border bg-gray-50 p-4">
          <h3 className="text-lg font-semibold">Order completed</h3>
          <p>Order No: {checkoutResult.order_number}</p>
          <p>Total: RM {checkoutResult.total.toFixed(2)}</p>
          {checkoutResult.receipt_public_url && (
            <div className="mt-3">
              <p className="text-sm font-medium">Guest Receipt QR</p>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkoutResult.receipt_public_url)}`}
                alt="Guest receipt QR"
                className="mt-2 h-[180px] w-[180px]"
              />
              <a href={checkoutResult.receipt_public_url} target="_blank" rel="noreferrer" className="block break-all text-xs text-blue-600 underline">
                {checkoutResult.receipt_public_url}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
