'use client'
import { useEffect, useState } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import { getBranchNotificationSettings, saveBranchNotificationSettings, type BranchNotificationSettings } from '@/lib/branchNotificationSettings'

const split = (value: string) => [...new Set(value.split(/[\n,]+/).map(v => v.trim().toLowerCase()).filter(Boolean))]
export default function BranchNotificationSettingsForm({ canEdit }: { canEdit: boolean }) {
  const { selectedBranchId, selectedBranch, loading: branchLoading } = useBranch()
  const [form, setForm] = useState<BranchNotificationSettings | null>(null)
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState('')
  useEffect(() => { setForm(null); setMessage(''); if (selectedBranchId) getBranchNotificationSettings(selectedBranchId).then(r => setForm(r.data)).catch(e => setMessage(e.message)) }, [selectedBranchId])
  if (branchLoading) return <div className="rounded-xl border bg-white p-6">Loading…</div>
  if (!selectedBranchId || !selectedBranch) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">Select a concrete Branch in the Header. All Branches cannot own notification settings.</div>
  if (!form) return <div className="rounded-xl border bg-white p-6">{message || 'Settings are not initialized for this Branch. Run the initialization command.'}</div>
  const toggle = (key: keyof BranchNotificationSettings, value: boolean | string | string[]) => setForm({ ...form, [key]: value })
  const cards: Array<{title:string; enabled:keyof BranchNotificationSettings; time?:keyof BranchNotificationSettings; recipients?:keyof BranchNotificationSettings; help:string}> = [
    { title:'Booking Reminder', enabled:'booking_reminder_enabled', time:'booking_reminder_send_at', help:'Customer reminder for tomorrow’s confirmed appointments.' },
    { title:'Booking Feedback', enabled:'booking_feedback_enabled', time:'booking_feedback_send_at', help:'Customer follow-up for appointments completed yesterday.' },
    { title:'Booking Payment Proof', enabled:'booking_payment_proof_enabled', recipients:'booking_payment_proof_recipients', help:'Branch recipients who review booking deposit proofs.' },
    { title:'Daily Order Summary', enabled:'daily_order_summary_enabled', time:'daily_order_summary_send_at', recipients:'daily_order_summary_recipients', help:'Branch-scoped pending bookings and fulfilment participation.' },
    { title:'Daily Low Stock', enabled:'daily_low_stock_enabled', time:'daily_low_stock_send_at', recipients:'daily_low_stock_recipients', help:'Only inventory rows belonging to this Branch.' },
  ]
  return <form onSubmit={async e => { e.preventDefault(); setSaving(true); setMessage(''); try { const r=await saveBranchNotificationSettings(selectedBranchId, form); if(r.data)setForm(r.data); setMessage(r.message || 'Saved.') } catch(e) { setMessage(e instanceof Error?e.message:'Unable to save.') } finally { setSaving(false) } }} className="space-y-5">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><strong>Branch: {selectedBranch.name}</strong><p className="mt-1 text-sm text-blue-800">SMTP sender remains global. Venue details come directly from this Branch record.</p></div>
    {cards.map(card => <section key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">{card.title}</h2><p className="text-sm text-slate-500">{card.help}</p></div><input type="checkbox" checked={Boolean(form[card.enabled])} disabled={!canEdit} onChange={e=>toggle(card.enabled,e.target.checked)} aria-label={`${card.title} enabled`} /></div>
      {card.time && <label className="mt-4 block text-sm font-medium">Send time<input type="time" className="mt-1 block rounded border px-3 py-2" value={String(form[card.time]).slice(0,5)} disabled={!canEdit} onChange={e=>toggle(card.time!,e.target.value)} /></label>}
      {card.recipients && <label className="mt-4 block text-sm font-medium">Recipients<textarea className="mt-1 block w-full rounded border px-3 py-2" rows={3} value={(form[card.recipients] as string[]).join('\n')} disabled={!canEdit} onChange={e=>toggle(card.recipients!,split(e.target.value))} /><span className="text-xs font-normal text-slate-500">One email per line or comma-separated. No runtime fallback is used.</span></label>}
    </section>)}
    {message && <p className="text-sm text-slate-700">{message}</p>}<button disabled={!canEdit||saving} className="rounded bg-blue-600 px-5 py-2 text-white disabled:opacity-50">{saving?'Saving…':'Save Branch Settings'}</button>
  </form>
}
