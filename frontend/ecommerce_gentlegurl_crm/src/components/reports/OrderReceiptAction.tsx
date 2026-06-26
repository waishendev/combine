'use client'

import { useState } from 'react'

import ReceiptSharePanel from './ReceiptSharePanel'

type OrderReceiptActionProps = {
  orderId: number
  orderNo?: string | null
}

type ReceiptPayload = {
  receipt_public_url: string
  customer_email?: string | null
}

export default function OrderReceiptAction({ orderId, orderNo }: OrderReceiptActionProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null)

  const openModal = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setReceipt(null)

    try {
      const response = await fetch(`/api/proxy/admin/reports/sales/${orderId}/details`, { cache: 'no-store' })
      const data = await response.json().catch(() => null) as {
        order?: { receipt_public_url?: string | null; customer_email?: string | null }
        message?: string
      } | null

      if (!response.ok) {
        setError(typeof data?.message === 'string' ? data.message : 'Unable to load receipt.')
        return
      }

      const receiptUrl = data?.order?.receipt_public_url
      if (!receiptUrl) {
        setError('Receipt is not available for this order.')
        return
      }

      setReceipt({
        receipt_public_url: receiptUrl,
        customer_email: data?.order?.customer_email ?? null,
      })
    } catch {
      setError('Unable to load receipt.')
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setOpen(false)
    setLoading(false)
    setError(null)
    setReceipt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        title={`Send or share receipt for ${orderNo ?? `order #${orderId}`}`}
        aria-label={`Send or share receipt for ${orderNo ?? `order #${orderId}`}`}
        className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      >
        <i className="fa-solid fa-receipt text-xs" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close receipt modal" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 text-left">Customer receipt</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{orderNo ?? `Order #${orderId}`}</h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading receipt…</p>
              ) : error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
              ) : receipt ? (
                <ReceiptSharePanel
                  orderId={orderId}
                  receiptPublicUrl={receipt.receipt_public_url}
                  defaultEmail={receipt.customer_email}
                  compact
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
