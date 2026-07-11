'use client'

import { useEffect, useState } from 'react'

import ReceiptSharePanel from './ReceiptSharePanel'

type RefundReportActionsProps = {
  refundId: number
  refundNo: string
  receiptPublicUrl?: string | null
  canVoid?: boolean
  onDone?: () => void
}

export default function RefundReportActions({
  refundId,
  refundNo,
  receiptPublicUrl,
  canVoid = false,
  onDone,
}: RefundReportActionsProps) {
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voidRemark, setVoidRemark] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(receiptPublicUrl ?? null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  const openReceipt = async () => {
    if (receiptUrl) {
      setReceiptOpen(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/pos/refunds/${refundId}/receipt`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const url = json?.data?.receipt_public_url ?? json?.data?.refund?.receipt_public_url
      if (!res.ok || !url) {
        setError(typeof json?.message === 'string' ? json.message : 'Refund receipt is not available.')
        return
      }
      setReceiptUrl(url)
      setReceiptOpen(true)
    } catch {
      setError('Unable to load refund receipt.')
    } finally {
      setLoading(false)
    }
  }

  const submitVoid = async () => {
    if (!voidRemark.trim()) {
      setError('Remarks are required to void this refund.')
      return
    }

    setVoiding(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/pos/refunds/${refundId}/void`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: voidRemark.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof json?.message === 'string' ? json.message : 'Unable to void refund.')
        return
      }
      setToast(typeof json?.message === 'string' ? json.message : 'Refund voided.')
      setVoidOpen(false)
      setVoidRemark('')
      onDone?.()
    } catch {
      setError('Unable to void refund.')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-4 top-4 z-[100] rounded bg-emerald-600 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      ) : null}

      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => void openReceipt()}
          disabled={loading}
          title={`View refund receipt for ${refundNo}`}
          aria-label={`View refund receipt for ${refundNo}`}
          className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <i className="fa-solid fa-spinner fa-spin text-xs" aria-hidden="true" />
          ) : (
            <i className="fa-solid fa-receipt text-xs" aria-hidden="true" />
          )}
        </button>
        {canVoid ? (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setVoidRemark('')
              setVoidOpen(true)
            }}
            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
          >
            Void
          </button>
        ) : null}
      </div>

      {error && !voidOpen ? <p className="mt-1 text-[10px] text-rose-700">{error}</p> : null}

      {receiptOpen && receiptUrl ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-600 text-left">Refund Receipt</h3>
                <p className="text-xs text-gray-500">{refundNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptSharePanel receiptPublicUrl={receiptUrl} />
          </div>
        </div>
      ) : null}

      {voidOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">Void Refund</h3>
              <p className="mt-1 text-xs text-gray-500">{refundNo}</p>
              <p className="mt-2 text-sm text-red-700">
                This will remove the refund from sales reports and restore the overpaid amount on the appointment.
              </p>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Reason for void (required)
              <textarea
                value={voidRemark}
                onChange={(e) => {
                  setError(null)
                  setVoidRemark(e.target.value)
                }}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Explain why this refund should be voided"
              />
            </label>

            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={voiding}
                onClick={() => {
                  setVoidOpen(false)
                  setError(null)
                }}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={voiding || !voidRemark.trim()}
                onClick={() => void submitVoid()}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {voiding ? 'Voiding…' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
