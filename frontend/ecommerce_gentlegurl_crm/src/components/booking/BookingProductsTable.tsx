'use client'

import { useCallback, useEffect, useState } from 'react'

type Cat = { id:number; name:string; sort_order:number; is_active:boolean }

type BookingProduct = {
  id: number
  name: string
  price: number
  barcode?: string | null
  description?: string | null
  category_id?: number | null
  category?: Cat | null
  is_active: boolean
}

export default function BookingProductsTable({ permissions = [] as string[] }) {
  const [items, setItems] = useState<BookingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', price: '', barcode: '', description: '', category_id: '', is_active: true })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [categories, setCategories] = useState<Cat[]>([])

  const canWrite = permissions.includes('booking.services.create') || permissions.includes('booking.services.update')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (search.trim()) qs.set('search', search.trim())
    const res = await fetch(`/api/proxy/admin/booking/products?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setItems(Array.isArray(json?.data?.data) ? json.data.data : Array.isArray(json?.data) ? json.data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { (async () => { const res = await fetch('/api/proxy/admin/booking/product-categories', { cache:'no-store' }); const json = await res.json(); setCategories((Array.isArray(json?.data)?json.data:[]).filter((c:Cat)=>c.is_active).sort((a:Cat,b:Cat)=>a.sort_order-b.sort_order||a.id-b.id)) })() }, [])

  const submit = async () => {
    const payload = { ...form, price: Number(form.price), category_id: form.category_id ? Number(form.category_id) : null }
    await fetch(`/api/proxy/admin/booking/products${editingId ? `/${editingId}` : ''}`, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setForm({ name: '', price: '', barcode: '', description: '', category_id: '', is_active: true })
    setEditingId(null)
    await fetchItems()
  }

  return <div className="space-y-4">
    <div className="flex gap-2">
      <input className="border px-3 py-2 rounded" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
      <button className="bg-gray-700 text-white px-3 py-2 rounded" onClick={() => fetchItems()}>Search</button>
    </div>

    {canWrite && <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded border">
      <input className="border px-2 py-1 rounded" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="border px-2 py-1 rounded" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
      <input className="border px-2 py-1 rounded" placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
      <select className="border px-2 py-1 rounded" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value=''>No category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input className="border px-2 py-1 rounded col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
      <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={submit}>{editingId ? 'Update' : 'Create'}</button>
    </div>}

    <div className="bg-white rounded border overflow-hidden">
      <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Price</th><th className="p-2 text-left">Category</th><th className="p-2 text-left">Status</th><th className="p-2">Actions</th></tr></thead>
      <tbody>
        {loading ? <tr><td className="p-3" colSpan={5}>Loading...</td></tr> : items.map((it) => <tr key={it.id} className="border-t"><td className="p-2">{it.name}</td><td className="p-2">{Number(it.price).toFixed(2)}</td><td className="p-2">{it.category?.name || '-'}</td><td className="p-2">{it.is_active ? 'Active' : 'Inactive'}</td><td className="p-2 space-x-2">{canWrite && <><button className="px-2 py-1 bg-blue-500 text-white rounded" onClick={() => {setEditingId(it.id); setForm({name:it.name,price:String(it.price),barcode:it.barcode||'',description:it.description||'',category_id:it.category_id?String(it.category_id):'',is_active:it.is_active})}}>Edit</button><button className="px-2 py-1 bg-red-500 text-white rounded" onClick={async () => { await fetch(`/api/proxy/admin/booking/products/${it.id}`,{method:'DELETE'}); await fetchItems() }}>Delete</button></>}</td></tr>)}
      </tbody></table>
    </div>
  </div>
}
