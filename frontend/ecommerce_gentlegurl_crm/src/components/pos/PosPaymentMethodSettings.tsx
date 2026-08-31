'use client'

import { useEffect, useState } from 'react'
import { useBranch } from '@/contexts/BranchContext'
import type { PosPaymentConfiguration } from '@/hooks/usePosPaymentConfiguration'

export default function PosPaymentMethodSettings() {
  const { selectedBranchId, selectedBranch } = useBranch()
  const [config, setConfig] = useState<PosPaymentConfiguration | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setConfig(null); setMessage('')
    if (!selectedBranchId) return
    fetch(`/api/proxy/pos/settings/payment-methods?store_location_id=${selectedBranchId}`, { cache: 'no-store' })
      .then(async r => { const p = await r.json(); if (!r.ok) throw new Error(p.message); setConfig(p.data) })
      .catch(e => setMessage(e.message || 'Unable to load configuration.'))
  }, [selectedBranchId])

  if (!selectedBranchId || !selectedBranch) return <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">Select a specific Branch in the header. ALL BRANCHES is not a POS configuration context.</div>
  if (!config) return <div className="rounded-xl border bg-white p-6">{message || 'Loading payment configuration…'}</div>

  const save = async () => {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/proxy/pos/settings/payment-methods', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || 'Save failed.')
      setConfig(payload.data); setMessage('POS payment configuration saved.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed.') } finally { setSaving(false) }
  }

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold text-slate-900">POS Payment Methods</h1><p className="text-sm text-slate-600">Branch: <b>{selectedBranch.name}{selectedBranch.code ? ` (${selectedBranch.code})` : ''}</b>. Online gateway settings are separate.</p></div>
    {!config.is_configured && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This Branch has not been explicitly configured. Safe defaults currently allow Cash only; save to materialize the configuration.</div>}
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Payment Method</th><th className="p-3">Enabled</th><th className="p-3">Sort Order</th></tr></thead><tbody>{config.methods.map((method, index) => <tr key={method.key} className="border-t"><td className="p-3 font-semibold">{method.name}</td><td className="p-3"><input type="checkbox" checked={method.is_enabled} onChange={e => setConfig({...config, methods: config.methods.map((m, i) => i === index ? {...m, is_enabled: e.target.checked} : m)})}/></td><td className="p-3"><input className="w-24 rounded border px-2 py-1" type="number" min="0" max="999" value={method.sort_order} onChange={e => setConfig({...config, methods: config.methods.map((m, i) => i === index ? {...m, sort_order: Number(e.target.value)} : m)})}/></td></tr>)}</tbody></table></div>
    <div className="flex items-center gap-3"><button disabled={saving || !config.methods.some(m => m.is_enabled)} onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Configuration'}</button><span className="text-sm text-slate-700">{message}</span></div>
  </div>
}
