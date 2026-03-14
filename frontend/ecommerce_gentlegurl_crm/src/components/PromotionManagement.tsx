'use client'

import { useEffect, useState } from 'react'

type ProductOption = { id: number; name: string; disabled: boolean; disabled_reason?: string | null }
type Tier = { min_qty?: number | null; min_amount?: number | null; discount_type: 'bundle_fixed_price' | 'percentage_discount' | 'fixed_discount'; discount_value: number }
type Promotion = { id: number; name?: string; title?: string; is_active: boolean; promotion_type: string; trigger_type: string; promotion_products?: Array<{ product_id: number; product?: { id: number; name: string } }>; promotion_tiers?: Tier[] }

const emptyTier = (): Tier => ({ min_qty: 1, min_amount: null, discount_type: 'bundle_fixed_price', discount_value: 0 })

export default function PromotionManagement() {
  const [rows, setRows] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [triggerType, setTriggerType] = useState<'quantity' | 'amount'>('quantity')
  const [promotionType, setPromotionType] = useState<Tier['discount_type']>('bundle_fixed_price')
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [tiers, setTiers] = useState<Tier[]>([emptyTier()])

  const load = async () => {
    const [pRes, oRes] = await Promise.all([
      fetch('/api/proxy/ecommerce/promotions-product-options', { cache: 'no-store' }),
      fetch('/api/proxy/ecommerce/promotions?per_page=100', { cache: 'no-store' }),
    ])
    const pJson = await pRes.json().catch(() => null)
    const oJson = await oRes.json().catch(() => null)
    setProducts((pJson?.data?.data ?? pJson?.data ?? []) as ProductOption[])
    setRows((oJson?.data?.data ?? oJson?.data ?? []) as Promotion[])
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  const submit = async () => {
    const res = await fetch('/api/proxy/ecommerce/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        is_active: active,
        trigger_type: triggerType,
        promotion_type: promotionType,
        product_ids: selectedProductIds,
        tiers: tiers.map((t) => ({ ...t, discount_type: promotionType })),
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      alert(json?.message ?? 'Failed to save promotion')
      return
    }

    setName('')
    setSelectedProductIds([])
    setTiers([emptyTier()])
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="rounded border p-4 space-y-3">
        <h3 className="font-semibold">Create Promotion</h3>
        <input className="w-full rounded border px-3 py-2" placeholder="Promotion Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <select className="rounded border px-2 py-2" value={triggerType} onChange={(e) => setTriggerType(e.target.value as 'quantity' | 'amount')}>
            <option value="quantity">quantity</option>
            <option value="amount">amount</option>
          </select>
          <select className="rounded border px-2 py-2" value={promotionType} onChange={(e) => setPromotionType(e.target.value as Tier['discount_type'])}>
            <option value="bundle_fixed_price">bundle fixed price</option>
            <option value="percentage_discount">percentage discount</option>
            <option value="fixed_discount">fixed discount</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active</label>
        </div>

        <div className="max-h-40 overflow-auto rounded border p-2 space-y-1">
          {products.map((p) => (
            <label key={p.id} className={`block text-sm ${p.disabled ? 'text-gray-400' : ''}`}>
              <input type="checkbox" disabled={p.disabled} checked={selectedProductIds.includes(p.id)} onChange={(e) => setSelectedProductIds((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))} /> {p.name}
              {p.disabled_reason ? <span className="ml-2 text-xs">({p.disabled_reason})</span> : null}
            </label>
          ))}
        </div>

        {tiers.map((tier, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2">
            {triggerType === 'quantity' ? (
              <input type="number" className="rounded border px-2 py-2" placeholder="Min qty" value={tier.min_qty ?? ''} onChange={(e) => setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, min_qty: Number(e.target.value), min_amount: null } : t))} />
            ) : (
              <input type="number" className="rounded border px-2 py-2" placeholder="Min amount" value={tier.min_amount ?? ''} onChange={(e) => setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, min_amount: Number(e.target.value), min_qty: null } : t))} />
            )}
            <input type="number" className="rounded border px-2 py-2" placeholder="Discount value" value={tier.discount_value} onChange={(e) => setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, discount_value: Number(e.target.value) } : t))} />
            <button className="rounded border px-2 py-2" onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2" onClick={() => setTiers((prev) => [...prev, emptyTier()])}>Add Tier</button>
          <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={() => void submit()}>Save</button>
        </div>
      </div>

      <div className="rounded border p-4">
        <h3 className="font-semibold mb-3">Promotions</h3>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded border p-2 text-sm">
              <p className="font-semibold">{row.name ?? row.title}</p>
              <p>Type: {row.promotion_type} | Trigger: {row.trigger_type}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
