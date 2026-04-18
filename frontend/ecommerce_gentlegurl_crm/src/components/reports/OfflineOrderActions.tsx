'use client'

import { useEffect, useMemo, useState } from 'react'

type StaffOption = { id: number; name: string }

type OfflineOrderActionsProps = {
  orderId: number
  channel: string
  currentPaymentMethod?: string | null
  onDone: () => void
}

const PAYMENT_OPTIONS = [
  'cash',
  'card',
  'qrpay',
  'online_banking',
  'manual_transfer',
  'billplz_fpx',
  'billplz_card',
  'billplz_online_banking',
  'billplz_credit_card',
]

const labelize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export default function OfflineOrderActions({ orderId, channel, currentPaymentMethod, onDone }: OfflineOrderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'sales_person' | 'payment_method' | 'void' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffId, setStaffId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(currentPaymentMethod ?? 'cash')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (modal !== 'sales_person') return
    void (async () => {
      const res = await fetch('/api/proxy/staffs?page=1&per_page=200', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      const rows: unknown[] = Array.isArray(json?.data?.data) ? json.data.data : []
      type StaffApiRow = { id?: number; name?: string }
      setStaffOptions(
        rows
          .map((item: unknown) => {
            const row = item as StaffApiRow
            return { id: Number(row.id), name: row.name ?? `Staff #${row.id}` }
          })
          .filter((item) => Number.isFinite(item.id)),
      )
    })()
  }, [modal])

  const isOffline = useMemo(() => channel.trim().toLowerCase() === 'offline', [channel])

  if (!isOffline) return null

  const closeModal = () => {
    setModal(null)
    setRemark('')
    setError(null)
    setSubmitting(false)
  }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      let endpoint = ''
      let payload: Record<string, unknown> = {}
      if (modal === 'sales_person') {
        if (!staffId) {
          setError('Please select a sales person.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/orders/${orderId}/offline-actions/sales-person`
        payload = { created_by_user_id: Number(staffId), remark: remark.trim() || null }
      } else if (modal === 'payment_method') {
        if (!paymentMethod.trim()) {
          setError('Please select payment method.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/orders/${orderId}/offline-actions/payment-method`
        payload = { payment_method: paymentMethod.trim(), remark: remark.trim() || null }
      } else {
        if (!remark.trim()) {
          setError('Remarks are required to void this order.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/orders/${orderId}/offline-actions/void`
        payload = { remark: remark.trim() }
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok || json?.success === false) {
        setError(typeof json?.message === 'string' ? json.message : 'Action failed.')
        setSubmitting(false)
        return
      }

      setToast({ type: 'success', text: typeof json?.message === 'string' ? json.message : 'Action completed.' })
      closeModal()
      onDone()
    } catch {
      setError('Unable to process this request.')
      setSubmitting(false)
    }
  }

  return (
    <>
      {toast ? (
        <div className={`fixed right-4 top-4 z-[100] rounded px-4 py-2 text-sm text-white shadow ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.text}
        </div>
      ) : null}

      <div className="relative inline-block text-left">
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          Actions <i className="fa-solid fa-chevron-down ml-1 text-[10px]" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded border border-slate-200 bg-white shadow-lg">
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => { setModal('sales_person'); setMenuOpen(false) }}>
              Edit Sales Person
            </button>
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => { setModal('payment_method'); setMenuOpen(false) }}>
              Edit Payment Method
            </button>
            <button type="button" className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => { setModal('void'); setMenuOpen(false) }}>
              Void Order
            </button>
          </div>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative w-full max-w-lg rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3">
              <h3 className="text-base font-semibold">
                {modal === 'sales_person' ? 'Edit Sales Person' : modal === 'payment_method' ? 'Edit Payment Method' : 'Void Offline Order'}
              </h3>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              {modal === 'void' ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">Warning: This will void the offline order and invalidate related payments.</p> : null}

              {modal === 'sales_person' ? (
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-10 w-full rounded border border-slate-300 px-3">
                  <option value="">Select sales person</option>
                  {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                </select>
              ) : null}

              {modal === 'payment_method' ? (
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-10 w-full rounded border border-slate-300 px-3">
                  {PAYMENT_OPTIONS.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
                </select>
              ) : null}

              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={4}
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder={modal === 'void' ? 'Remarks (required)' : 'Remarks (optional)'}
              />

              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-xs">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={submitting} className={`rounded px-3 py-2 text-xs text-white ${modal === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60`}>
                {submitting ? 'Saving...' : modal === 'void' ? 'Confirm Void' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
