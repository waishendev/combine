'use client'

import { ChangeEvent, FormEvent, useState } from 'react'
import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'

interface StaffCreateModalProps { onClose: () => void; onSuccess: (staff: StaffRowData) => void }

interface FormState { code:string; name:string; phone:string; email:string; password:string; username:string; position:string; description:string; commissionPercent:string; serviceCommissionPercent:string; avatarFile: File | null }
const initialFormState: FormState = { code:'',name:'',phone:'',email:'',password:'',username:'',position:'',description:'',commissionPercent:'0',serviceCommissionPercent:'0',avatarFile:null }

export default function StaffCreateModal({ onClose, onSuccess }: StaffCreateModalProps) {
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('email', form.email.trim())
      fd.append('password', form.password.trim())
      fd.append('code', form.code.trim())
      fd.append('phone', form.phone.trim())
      fd.append('username', form.username.trim())
      fd.append('position', form.position.trim())
      fd.append('description', form.description.trim())
      fd.append('commission_rate', String((Number(form.commissionPercent || 0) / 100) || 0))
      fd.append('service_commission_rate', String((Number(form.serviceCommissionPercent || 0) / 100) || 0))
      fd.append('is_active', '1')
      if (form.avatarFile) fd.append('avatar', form.avatarFile)

      const res = await fetch('/api/proxy/staffs', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError((data as {message?:string})?.message ?? 'Failed to create staff.'); return }
      const payload = data?.data?.staff ?? data?.data
      onSuccess(payload ? mapStaffApiItemToRow(payload as StaffApiItem) : ({} as StaffRowData))
    } catch { setError('Failed to create staff.') } finally { setSubmitting(false) }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/50" onClick={onClose} /><div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg"><div className="flex items-center justify-between border-b border-gray-300 px-5 py-4"><h2 className="text-lg font-semibold">Create Staff</h2></div><form onSubmit={handleSubmit} className="px-5 py-4 space-y-3"><input name="name" value={form.name} onChange={handleChange} placeholder="Name" className="w-full border p-2 rounded" /><input name="email" value={form.email} onChange={handleChange} placeholder="Email" className="w-full border p-2 rounded" /><input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" className="w-full border p-2 rounded" /><input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone" className="w-full border p-2 rounded" /><input name="position" value={form.position} onChange={handleChange} placeholder="Position" className="w-full border p-2 rounded" /><textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="w-full border p-2 rounded" /><input type="file" accept="image/*" onChange={(e)=>setForm((p)=>({...p,avatarFile:e.target.files?.[0]??null}))} className="w-full" />{error && <div className="text-sm text-red-600">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-3 py-2 border rounded">Cancel</button><button disabled={submitting} className="px-3 py-2 bg-blue-600 text-white rounded">Create</button></div></form></div></div>
}
