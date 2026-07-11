'use client'

import { useState } from 'react'

import ReceiptSharePanel from './ReceiptSharePanel'

type RefundReceiptActionProps = {
  refundId: number
  refundNo: string
  receiptPublicUrl?: string | null
}

export default function RefundReceiptAction({ refundId, refundNo, receiptPublicUrl }: RefundReceiptActionProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(receiptPublicUrl ?? null)

  const openReceipt = async () => {
    if (receiptUrl) {
      setOpen(true)
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
      setOpen(true)
    } catch {
      setError('Unable to load refund receipt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
      {error ? <p className="mt-1 text-[10px] text-rose-700">{error}</p> : null}
      {open && receiptUrl ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-600 text-left">Refund Receipt</h3>
                <p className="text-xs text-gray-500">{refundNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptSharePanel receiptPublicUrl={receiptUrl} />
          </div>
        </div>
      ) : null}
    </>
  )
}
