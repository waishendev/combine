'use client'

import { useEffect, useState } from 'react'

type Branch = { id: number; name: string; code: string; is_active: boolean }

export default function ShippingFulfillmentPriorityCard({ canEdit }: { canEdit: boolean }) {
  const [all, setAll] = useState<Branch[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    void Promise.all([
      fetch('/api/proxy/ecommerce/shipping-fulfillment-priority', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/proxy/ecommerce/store-locations?per_page=100', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([priority, branches]) => {
      setSelected(priority?.data?.store_location_ids ?? [])
      const rows = branches?.data?.data ?? branches?.data ?? []
      setAll(Array.isArray(rows) ? rows : [])
    }).catch(() => setMessage('Unable to load shipping fulfilment priority.'))
  }, [])

  const move = (index: number, offset: number) => {
    const next = [...selected]
    const target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSelected(next)
  }

  const save = async () => {
    setMessage('Saving…')
    const response = await fetch('/api/proxy/ecommerce/shipping-fulfillment-priority', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_location_ids: selected }),
    })
    setMessage(response.ok ? 'Shipping fulfilment priority saved.' : 'Unable to save shipping fulfilment priority.')
  }

  const byId = new Map(all.map((branch) => [branch.id, branch]))
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Ecommerce Shipping Fulfilment Priority</h3>
      <p className="mt-1 text-sm text-slate-500">The first active Branch able to fulfil the entire cart is selected. Orders are never split.</p>
      <div className="mt-4 space-y-2">
        {selected.map((id, index) => {
          const branch = byId.get(id)
          if (!branch) return null
          return <div key={id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <span className="w-6 text-sm font-semibold text-slate-500">{index + 1}</span>
            <span className="flex-1 text-sm font-medium text-slate-800">{branch.name}{!branch.is_active ? ' (inactive — skipped)' : ''}</span>
            <button type="button" disabled={!canEdit || index === 0} onClick={() => move(index, -1)} className="rounded border px-2 py-1 text-xs disabled:opacity-30">Up</button>
            <button type="button" disabled={!canEdit || index === selected.length - 1} onClick={() => move(index, 1)} className="rounded border px-2 py-1 text-xs disabled:opacity-30">Down</button>
            <button type="button" disabled={!canEdit} onClick={() => setSelected((ids) => ids.filter((value) => value !== id))} className="text-xs font-medium text-red-600 disabled:opacity-30">Remove</button>
          </div>
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {all.filter((branch) => !selected.includes(branch.id)).map((branch) =>
          <button key={branch.id} type="button" disabled={!canEdit} onClick={() => setSelected((ids) => [...ids, branch.id])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Add {branch.name}</button>)}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-slate-500">{message}</p>
        <button type="button" disabled={!canEdit} onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-300">Save priority</button>
      </div>
    </section>
  )
}
