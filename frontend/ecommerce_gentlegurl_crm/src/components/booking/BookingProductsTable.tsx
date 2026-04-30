'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Cat = { id:number; name:string; sort_order:number; is_active:boolean }
type BookingProduct = {
  id:number; name:string; price:number; barcode?:string|null; description?:string|null;
  category_id?:number|null; category?:Cat|null; is_active:boolean; image_path?:string|null; image_url?:string|null
}

export default function BookingProductsTable({ permissions = [] as string[] }) {
  const canWrite = permissions.includes('booking.services.create') || permissions.includes('booking.services.update')
  const [items,setItems]=useState<BookingProduct[]>([])
  const [categories,setCategories]=useState<Cat[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [editingId,setEditingId]=useState<number|null>(null)
  const [previewUrl,setPreviewUrl]=useState<string | null>(null)
  const [form,setForm]=useState({name:'',price:'',barcode:'',description:'',category_id:'',is_active:true,image:null as File|null,image_url:''})

  const categoryOptions = useMemo(()=>categories.filter(c=>c.is_active).sort((a,b)=>a.sort_order-b.sort_order||a.id-b.id),[categories])

  const fetchItems = useCallback(async()=>{
    setLoading(true); const qs=new URLSearchParams(); if(search.trim()) qs.set('search',search.trim())
    const r=await fetch(`/api/proxy/admin/booking/products?${qs.toString()}`,{cache:'no-store'}); const j=await r.json();
    setItems(Array.isArray(j?.data?.data)?j.data.data:Array.isArray(j?.data)?j.data:[]); setLoading(false)
  },[search])

  useEffect(()=>{void fetchItems()},[fetchItems])
  useEffect(()=>{(async()=>{const r=await fetch('/api/proxy/admin/booking/product-categories',{cache:'no-store'});const j=await r.json();setCategories(Array.isArray(j?.data)?j.data:[])})()},[])

  const submit=async()=>{
    const fd=new FormData(); fd.append('name',form.name); fd.append('price',String(Number(form.price||0))); fd.append('barcode',form.barcode); fd.append('description',form.description); fd.append('is_active',form.is_active?'1':'0');
    if(form.category_id) fd.append('category_id',form.category_id); if(form.image) fd.append('image',form.image)
    await fetch(`/api/proxy/admin/booking/products${editingId?`/${editingId}`:''}`,{method:editingId?'POST':'POST',headers:editingId?{'X-HTTP-Method-Override':'PUT'}:undefined,body:fd})
    setEditingId(null); setPreviewUrl(null); setForm({name:'',price:'',barcode:'',description:'',category_id:'',is_active:true,image:null,image_url:''}); await fetchItems()
  }

  return <div className='space-y-4'>
    <div className='flex gap-2'><input className='border px-3 py-2 rounded' value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search'/><button className='bg-gray-700 text-white px-3 py-2 rounded' onClick={()=>void fetchItems()}>Search</button></div>
    {canWrite && <div className='grid grid-cols-2 gap-2 bg-white p-3 rounded border'>
      <input className='border px-2 py-1 rounded' value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder='Name'/>
      <input className='border px-2 py-1 rounded' value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder='Price'/>
      <input className='border px-2 py-1 rounded' value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} placeholder='Barcode'/>
      <select className='border px-2 py-1 rounded' value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value=''>No category</option>{categoryOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <input type='file' accept='image/*' className='border px-2 py-1 rounded col-span-2' onChange={e=>{const f=e.target.files?.[0]??null; setForm({...form,image:f}); setPreviewUrl(f?URL.createObjectURL(f):null)}}/>
      {(previewUrl || form.image_url) && <img src={previewUrl || form.image_url} alt='Preview' className='h-16 w-16 object-cover rounded border' />}
      <input className='border px-2 py-1 rounded col-span-2' value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder='Description'/>
      <label><input type='checkbox' checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label>
      <button className='bg-blue-600 text-white px-3 py-1 rounded' onClick={submit}>{editingId?'Update':'Create'}</button>
    </div>}
    <div className='bg-white rounded border overflow-hidden'>
      <table className='min-w-full text-sm'><thead className='bg-slate-100'><tr><th className='p-2'>Image</th><th className='p-2 text-left'>Name</th><th className='p-2 text-left'>Price</th><th className='p-2 text-left'>Category</th><th className='p-2 text-left'>Status</th><th className='p-2'>Actions</th></tr></thead>
      <tbody>{loading?<tr><td className='p-3' colSpan={6}>Loading...</td></tr>:items.map(it=><tr key={it.id} className='border-t'><td className='p-2'>{it.image_url?<img src={it.image_url} className='h-10 w-10 object-cover rounded border' alt={it.name}/>:<div className='h-10 w-10 rounded border bg-gray-100'/>}</td><td className='p-2'>{it.name}</td><td className='p-2'>{Number(it.price).toFixed(2)}</td><td className='p-2'>{it.category?.name||'-'}</td><td className='p-2'>{it.is_active?'Active':'Inactive'}</td><td className='p-2 space-x-2'>{canWrite&&<><button className='px-2 py-1 bg-blue-500 text-white rounded' onClick={()=>{setEditingId(it.id);setPreviewUrl(null);setForm({name:it.name,price:String(it.price),barcode:it.barcode||'',description:it.description||'',category_id:it.category_id?String(it.category_id):'',is_active:it.is_active,image:null,image_url:it.image_url||''})}}>Edit</button><button className='px-2 py-1 bg-red-500 text-white rounded' onClick={async()=>{await fetch(`/api/proxy/admin/booking/products/${it.id}`,{method:'DELETE'});await fetchItems()}}>Delete</button></>}</td></tr>)}</tbody></table>
    </div>
  </div>
}
