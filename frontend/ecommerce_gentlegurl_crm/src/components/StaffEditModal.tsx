'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'

interface StaffEditModalProps { staffId: number; onClose: () => void; onSuccess: (staff: StaffRowData) => void }
interface FormState { name:string; phone:string; email:string; password:string; username:string; code:string; position:string; description:string; commissionPercent:string; serviceCommissionPercent:string; isActive:'true'|'false'; avatarFile:File|null }
const initialFormState: FormState = { name:'',phone:'',email:'',password:'',username:'',code:'',position:'',description:'',commissionPercent:'0',serviceCommissionPercent:'0',isActive:'true',avatarFile:null }

export default function StaffEditModal({ staffId, onClose, onSuccess }: StaffEditModalProps) {
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(()=>{(async()=>{const res=await fetch(`/api/proxy/staffs/${staffId}`);const data=await res.json();const s=data?.data as StaffApiItem; if(s){const r=mapStaffApiItemToRow(s); setForm((p)=>({...p,name:r.name,email:r.email,phone:r.phone,username:r.loginUsername==='-'?'':r.loginUsername,code:r.code==='-'?'':r.code,position:r.position,description:r.description,commissionPercent:String(r.commissionRate*100),serviceCommissionPercent:String(r.serviceCommissionRate*100),isActive:r.isActive?'true':'false'}));} setLoading(false)})()},[staffId])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value } = event.target; setForm((prev) => ({ ...prev, [name]: value })) }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError(null)
    try {
      const fd = new FormData(); fd.append('_method', 'PUT'); fd.append('name', form.name.trim()); fd.append('email', form.email.trim()); fd.append('phone', form.phone.trim()); fd.append('username', form.username.trim()); fd.append('code', form.code.trim()); fd.append('position', form.position.trim()); fd.append('description', form.description.trim()); fd.append('commission_rate', String((Number(form.commissionPercent || 0) / 100) || 0)); fd.append('service_commission_rate', String((Number(form.serviceCommissionPercent || 0) / 100) || 0)); fd.append('is_active', form.isActive === 'true' ? '1' : '0'); if (form.password.trim()) fd.append('password', form.password.trim()); if (form.avatarFile) fd.append('avatar', form.avatarFile)
      const res = await fetch(`/api/proxy/staffs/${staffId}`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError((data as {message?:string})?.message ?? 'Failed to update staff.'); return }
      onSuccess(mapStaffApiItemToRow((data?.data ?? {}) as StaffApiItem))
    } catch { setError('Failed to update staff.') } finally { setSubmitting(false) }
  }

  if (loading) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={onClose} /><div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg"><div className="flex items-center justify-between border-b border-gray-300 px-5 py-4"><h2 className="text-lg font-semibold">Edit Staff</h2></div><form onSubmit={handleSubmit} className="px-5 py-4 space-y-3"><input name="name" value={form.name} onChange={handleChange} className="w-full border p-2 rounded" /><input name="email" value={form.email} onChange={handleChange} className="w-full border p-2 rounded" /><input name="position" value={form.position} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Position" /><textarea name="description" value={form.description} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Description" /><input name="password" type="password" value={form.password} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Leave blank to keep" /><select name="isActive" value={form.isActive} onChange={handleChange} className="w-full border p-2 rounded"><option value="true">Active</option><option value="false">Inactive</option></select><input type="file" accept="image/*" onChange={(e)=>setForm((p)=>({...p,avatarFile:e.target.files?.[0]??null}))} className="w-full" />{error && <div className="text-sm text-red-600">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-3 py-2 border rounded">Cancel</button><button disabled={submitting} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button></div></form></div></div>
}
