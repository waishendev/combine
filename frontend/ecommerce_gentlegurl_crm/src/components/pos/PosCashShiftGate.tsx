'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

type PosCashShift = {
  id: number
  opening_amount: number
  opened_by_name?: string | null
  opened_at?: string | null
  closing_amount?: number | null
  closed_at?: string | null
  status: 'OPEN' | 'CLOSED'
  cash_sales: number
  expected_cash: number
  difference?: number | null
}

type PosCashShiftGateProps = {
  children: ReactNode
}

const currency = (value: number | null | undefined) => `RM ${Number(value ?? 0).toFixed(2)}`
const formatDateTime = (value?: string | null) => (value ? new Date(value.replace(' ', 'T')).toLocaleString() : '—')

export default function PosCashShiftGate({ children }: PosCashShiftGateProps) {
  const [shift, setShift] = useState<PosCashShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [remark, setRemark] = useState('')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCurrentShift = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/current', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to check current cash shift.')
      const currentShift = (json?.data?.shift ?? null) as PosCashShift | null
      setShift(currentShift)
      return currentShift
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check current cash shift.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCurrentShift()
  }, [loadCurrentShift])

  const expectedCash = Number(shift?.expected_cash ?? 0)
  const closeDifference = useMemo(() => Number(closingAmount || 0) - expectedCash, [closingAmount, expectedCash])

  const openShift = async () => {
    const amount = Number(openingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Opening amount must be 0 or greater.')
      return
    }

    setOpening(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount: amount }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to open cash shift.')
      setShift((json?.data?.shift ?? null) as PosCashShift | null)
      setOpeningAmount('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open cash shift.')
    } finally {
      setOpening(false)
    }
  }

  const closeShift = async () => {
    const amount = Number(closingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Closing amount must be 0 or greater.')
      return
    }

    setClosing(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_amount: amount, remark: remark.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to close cash shift.')
      setShift(null)
      setClosingAmount('')
      setRemark('')
      setCloseModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close cash shift.')
    } finally {
      setClosing(false)
    }
  }

  const blocked = !shift

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        {shift ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm">
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Current Shift: OPEN</span>
            <span><b>Opening:</b> {currency(shift.opening_amount)}</span>
            <span><b>Opened At:</b> {formatDateTime(shift.opened_at)}</span>
            <button
              type="button"
              onClick={() => {
                setError(null)
                void loadCurrentShift().then((currentShift) => {
                  const shiftForClose = currentShift ?? shift
                  setClosingAmount(Number(shiftForClose.expected_cash ?? 0).toFixed(2))
                  setCloseModalOpen(true)
                })
              }}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Close Shift
            </button>
          </div>
        ) : null}
      </div>

      <div className={blocked ? 'pointer-events-none select-none opacity-40 blur-[1px]' : ''}>{children}</div>

      {blocked ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-slate-900 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Open Cash Shift</h3>
              <p className="mt-1 text-sm text-slate-200">Open a cash drawer shift before using POS.</p>
            </div>
            <div className="space-y-4 p-6">
              {loading ? <p className="text-sm text-gray-600">Checking current shift…</p> : null}
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
              <label className="block text-sm font-semibold text-gray-700">
                Opening Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingAmount}
                  onChange={(event) => setOpeningAmount(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="0.00"
                  autoFocus
                />
              </label>
              <button
                type="button"
                onClick={() => void openShift()}
                disabled={loading || opening}
                className="h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opening ? 'Opening…' : 'Confirm Open Shift'}
              </button>
              <p className="text-xs text-gray-500">This modal cannot be skipped. Close shifts manually when cash drawer counting is complete.</p>
            </div>
          </div>
        </div>
      ) : null}

      {closeModalOpen && shift ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-red-700 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Close Cash Shift</h3>
              <p className="mt-1 text-sm text-red-100">Count the drawer and enter the close cash amount.</p>
            </div>
            <div className="space-y-4 p-6">
              {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Cash Sales</p><p className="font-bold">{currency(shift.cash_sales)}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Expected Cash</p><p className="font-bold">{currency(shift.expected_cash)}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Opening Amount</p><p className="font-bold">{currency(shift.opening_amount)}</p></div>
                <div className={`rounded-xl p-3 ${closeDifference < 0 ? 'bg-red-50' : closeDifference > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className="text-gray-500">Difference Preview</p><p className="font-bold">{currency(closeDifference)}</p></div>
              </div>
              <label className="block text-sm font-semibold text-gray-700">
                Closing Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingAmount}
                  onChange={(event) => setClosingAmount(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Remark (optional)
                <textarea
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCloseModalOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={() => void closeShift()} disabled={closing} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{closing ? 'Closing…' : 'Confirm Close'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
