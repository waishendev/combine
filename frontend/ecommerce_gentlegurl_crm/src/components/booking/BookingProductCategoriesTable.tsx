'use client'
import { useEffect, useState } from 'react'

type Cat = { id:number; name:string; sort_order:number; is_active:boolean }
export default function BookingProductCategoriesTable({permissions=[] as string[]}) {
  const [rows,setRows]=useState<Cat[]>([]); const [name,setName]=useState(''); const [sortOrder,setSort]=useState('0')
  const canWrite = permissions.includes('booking.services.update') || permissions.includes('booking.services.create')
  const load=async()=>{ const r=await fetch('/api/proxy/admin/booking/product-categories',{cache:'no-store'}); const j=await r.json(); setRows(Array.isArray(j?.data)?j.data:[]) }
  useEffect(()=>{void load()},[])
  return <div className='space-y-3'>
    {canWrite && <div className='flex gap-2'><input className='border px-2 py-1 rounded' value={name} onChange={e=>setName(e.target.value)} placeholder='Category name' /><input className='border px-2 py-1 rounded w-28' value={sortOrder} onChange={e=>setSort(e.target.value)} placeholder='Sort' /><button className='bg-blue-600 text-white rounded px-3 py-1' onClick={async()=>{await fetch('/api/proxy/admin/booking/product-categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,sort_order:Number(sortOrder),is_active:true})});setName('');setSort('0');await load()}}>Create</button></div>}
    <table className='min-w-full text-sm bg-white border rounded'><thead><tr><th className='p-2 text-left'>Name</th><th className='p-2 text-left'>Sort</th><th className='p-2 text-left'>Status</th><th className='p-2'>Actions</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className='border-t'><td className='p-2'>{r.name}</td><td className='p-2'>{r.sort_order}</td><td className='p-2'>{r.is_active?'Active':'Inactive'}</td><td className='p-2'>{canWrite&&<button className='bg-red-500 text-white px-2 py-1 rounded' onClick={async()=>{await fetch(`/api/proxy/admin/booking/product-categories/${r.id}`,{method:'DELETE'});await load()}}>Deactivate</button>}</td></tr>)}</tbody></table>
  </div>
}
