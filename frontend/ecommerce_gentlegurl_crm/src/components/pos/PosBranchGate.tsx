'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useBranch } from '@/contexts/BranchContext'

export default function PosBranchGate({ children }: { children: ReactNode }) {
  const { selectedBranchId, selectedBranch, loading } = useBranch()
  const [transportReady, setTransportReady] = useState(false)

  useEffect(() => {
    if (!selectedBranchId) { setTransportReady(false); return }
    const nativeFetch = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (!raw.includes('/api/proxy/ecommerce/pos') && !raw.includes('/api/proxy/pos/') && !raw.includes('/api/proxy/ecommerce/thermal-printer-settings')) return nativeFetch(input, init)
      const url = new URL(raw, window.location.origin)
      url.searchParams.set('store_location_id', String(selectedBranchId))
      const nextInput = typeof input === 'string' ? `${url.pathname}${url.search}` : url
      return nativeFetch(nextInput, init)
    }
    setTransportReady(true)
    return () => { window.fetch = nativeFetch; setTransportReady(false) }
  }, [selectedBranchId])

  if (loading) return <div className="rounded-lg border bg-white p-6">Loading Branch Context…</div>
  if (!selectedBranchId || !selectedBranch) return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950">
      <h2 className="font-semibold">Select a specific Branch to use POS</h2>
      <p className="mt-2 text-sm">All Branches is for reporting and configuration only. POS carts cannot operate across Branches.</p>
    </div>
  )
  if (!selectedBranch.is_active || !selectedBranch.is_pos_available) return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-900">{selectedBranch.name} is not enabled for new POS operations.</div>
  )
  return transportReady ? children : null
}
