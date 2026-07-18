'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'

type WalletTransactionDetail = {
  id: number
  transaction_no?: string | null
  receipt_no?: string | null
  type?: string | null
  direction?: string | null
  amount?: string | number | null
  balance_before?: string | number | null
  balance_after?: string | number | null
  workspace_type?: string | null
  payment_method_label?: string | null
  reference_no?: string | null
  source_type?: string | null
  source_id?: string | number | null
  status?: string | null
  remark?: string | null
  created_at?: string | null
  submitted_at?: string | null
  approved_at?: string | null
  completed_at?: string | null
  approval_remark?: string | null
  customer?: { id?: number; name?: string | null; email?: string | null; phone?: string | null } | null
  processor?: { id?: number; name?: string | null } | null
  payment_proof?: { url?: string | null; uploaded_at?: string | null; original_name?: string | null } | null
}

type Props = {
  customerId: string | number
  transactionId: number
  fallback?: Partial<WalletTransactionDetail> | null
  onClose: () => void
}

function money(value?: string | number | null) {
  const num = Number(value ?? 0)
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number.isFinite(num) ? num : 0)
}

function dateTime(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function titleFor(tx?: Partial<WalletTransactionDetail> | null) {
  if (tx?.type === 'topup') return tx.status === 'completed' ? 'Balance Top Up Receipt' : 'Balance Top Up Details'
  if (tx?.type === 'admin_credit') return 'Balance Adjustment Receipt · CRM Deposit'
  if (tx?.type === 'admin_debit') return 'Balance Adjustment Receipt · CRM Withdrawal'
  if (tx?.type === 'refund_credit') return 'Customer Credit Receipt'
  return tx?.status === 'completed' ? 'Wallet Transaction Receipt' : 'Wallet Transaction Details'
}

function typeLabel(tx?: Partial<WalletTransactionDetail> | null) {
  if (tx?.type === 'topup') return 'Customer Top Up'
  if (tx?.type === 'admin_credit') return 'CRM Deposit'
  if (tx?.type === 'admin_debit') return 'CRM Withdrawal'
  if (tx?.type === 'refund_credit') return 'Refund Credit'
  if (tx?.type === 'reversal') return 'Reversal'
  return tx?.type || '-'
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value ?? '-'}</dd>
    </div>
  )
}

export default function WalletTransactionDetailDrawer({ customerId, transactionId, fallback, onClose }: Props) {
  const [detail, setDetail] = useState<WalletTransactionDetail | null>(fallback ? { id: transactionId, ...fallback } as WalletTransactionDetail : null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/proxy/admin/customers/${customerId}/wallet/transactions/${transactionId}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(String(json?.message ?? 'Unable to load wallet transaction.'))
        return json?.data?.transaction as WalletTransactionDetail | undefined
      })
      .then((tx) => { if (!cancelled && tx) setDetail(tx) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load wallet transaction.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [customerId, transactionId])

  const isTopup = detail?.type === 'topup'
  const proofUrl = detail?.payment_proof?.url
  const isImageProof = useMemo(() => Boolean(proofUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(proofUrl)), [proofUrl])

  return (
    <div className="fixed inset-0 z-[80] flex bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hidden flex-1 md:block" />
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Customer Balance</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{titleFor(detail)}</h3>
            <p className="mt-1 text-sm text-slate-500">{detail?.transaction_no ?? fallback?.transaction_no ?? `#${transactionId}`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
        </div>

        <div className="space-y-5 p-5">
          {loading ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading wallet transaction…</p> : null}
          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900">Transaction</h4>
            <dl className="mt-3 grid gap-3 md:grid-cols-2">
              <DetailRow label="Transaction No" value={detail?.transaction_no} />
              <DetailRow label="Receipt No" value={detail?.receipt_no} />
              <DetailRow label="Type" value={typeLabel(detail)} />
              <DetailRow label="Status" value={detail?.status} />
              <DetailRow label="Amount" value={money(detail?.amount)} />
              <DetailRow label="Direction" value={detail?.direction} />
              <DetailRow label="Balance Before" value={money(detail?.balance_before)} />
              <DetailRow label="Balance After" value={money(detail?.balance_after)} />
              <DetailRow label="Reference No" value={detail?.reference_no} />
              <DetailRow label="Source Reference" value={detail?.source_id == null ? '-' : String(detail.source_id)} />
            </dl>
          </section>

          {isTopup ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900">Top Up Payment</h4>
              <dl className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailRow label="Customer" value={detail?.customer?.name} />
                <DetailRow label="Payment Method" value={detail?.payment_method_label} />
                <DetailRow label="Workspace" value={detail?.workspace_type} />
                <DetailRow label="Created Time" value={dateTime(detail?.created_at)} />
                <DetailRow label="Submitted Time" value={dateTime(detail?.submitted_at)} />
                <DetailRow label="Approved Time" value={dateTime(detail?.approved_at ?? detail?.completed_at)} />
                <DetailRow label="Processed By" value={detail?.processor?.name} />
                <DetailRow label="Remark / Reason" value={detail?.remark} />
              </dl>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Uploaded Payment Proof</p>
                {proofUrl ? (
                  <div className="mt-3 space-y-3">
                    {isImageProof ? <img src={proofUrl} alt="Uploaded payment proof" className="max-h-96 rounded-lg border border-slate-200 object-contain" /> : null}
                    <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Open payment proof</a>
                    <p className="text-xs text-slate-500">{detail?.payment_proof?.original_name || 'Uploaded proof'} · {dateTime(detail?.payment_proof?.uploaded_at)}</p>
                  </div>
                ) : <p className="mt-2 text-sm text-slate-500">No uploaded payment proof found for this transaction.</p>}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900">CRM Adjustment</h4>
              <dl className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailRow label="Staff" value={detail?.processor?.name} />
                <DetailRow label="Date / Time" value={dateTime(detail?.completed_at ?? detail?.created_at)} />
                <DetailRow label="Reason" value={detail?.remark} />
                <DetailRow label="Reference" value={detail?.reference_no} />
              </dl>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900">Receipt</h4>
            <p className="mt-2 text-sm text-slate-600">{detail?.status === 'completed' ? 'This wallet receipt is available for audit from this detail view.' : 'This transaction is not completed yet, so this screen is a details view rather than a completed receipt.'}</p>
          </section>
        </div>
      </aside>
    </div>
  )
}
