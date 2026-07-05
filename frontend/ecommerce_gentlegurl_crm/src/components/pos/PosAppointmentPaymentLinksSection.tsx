'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { formatDateTime12Hour } from '@/lib/formatDateTime'

import PaymentProofModal from '@/components/payment/PaymentProofModal'

import PosModalShell from './PosModalShell'
import type { PosPaymentLink, PosPaymentLinkStatus } from './posAppointmentTypes'

type BookingCustomerFallback = {
  name?: string | null
  phone?: string | null
  email?: string | null
}

type PosAppointmentPaymentLinksSectionProps = {
  bookingId: number
  bookingCode?: string | null
  /** Booking customer / guest — used when payer is not yet captured on the link. */
  bookingCustomer?: BookingCustomerFallback | null
  /** Suggested amount (usually the outstanding balance) prefilled into the generate form. */
  defaultAmount?: number
  showMsg?: (message: string, type: 'success' | 'error') => void
  /** Fired after a link payment is confirmed (approve) so the parent can refresh financials. */
  onDepositRecorded?: () => void
  disabled?: boolean
}

const STATUS_BADGE: Record<PosPaymentLinkStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
  EXPIRED: 'bg-gray-200 text-gray-600',
}

const STATUS_LABEL: Record<PosPaymentLinkStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  billplz_credit_card: 'Credit Card',
  billplz_card: 'Credit Card',
  billplz_fpx: 'Online Banking',
  billplz_online_banking: 'Online Banking',
  manual_transfer: 'Manual Transfer',
  billplz: 'Billplz',
}

function formatLinkPaymentMethod(link: PosPaymentLink): string {
  const raw = String(link.provider ?? '').trim().toLowerCase()
  if (raw) {
    return PAYMENT_METHOD_LABELS[raw] ?? raw.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  if (link.has_slip || link.manual_slip_url) return 'Manual Transfer'
  if (link.status === 'PENDING') return 'Not selected yet'
  return '—'
}

function DetailInfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-snug text-slate-900">{value}</dd>
    </div>
  )
}

function resolvePayer(link: PosPaymentLink, fallback?: BookingCustomerFallback | null) {
  return {
    name: link.payer?.name?.trim() || fallback?.name?.trim() || null,
    phone: link.payer?.phone?.trim() || fallback?.phone?.trim() || null,
    email: link.payer?.email?.trim() || fallback?.email?.trim() || null,
  }
}

export default function PosAppointmentPaymentLinksSection({
  bookingId,
  bookingCode,
  bookingCustomer,
  defaultAmount,
  showMsg,
  onDepositRecorded,
  disabled = false,
}: PosAppointmentPaymentLinksSectionProps) {
  const [links, setLinks] = useState<PosPaymentLink[]>([])
  const [loading, setLoading] = useState(bookingId > 0)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [amountDraft, setAmountDraft] = useState('')
  const [expiryHours, setExpiryHours] = useState('72')
  const [notesDraft, setNotesDraft] = useState('')
  const [actionId, setActionId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [detailLinkId, setDetailLinkId] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const onDepositRecordedRef = useRef(onDepositRecorded)

  useEffect(() => {
    onDepositRecordedRef.current = onDepositRecorded
  }, [onDepositRecorded])

  const refreshLinks = useCallback(async (options?: { silent?: boolean }) => {
    if (!bookingId) return
    if (!options?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/payment-links`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg?.(json?.message ?? 'Failed to load payment links.', 'error')
        return
      }
      setLinks((json?.data?.payment_links ?? []) as PosPaymentLink[])
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [bookingId, showMsg])

  useEffect(() => {
    void refreshLinks()
  }, [refreshLinks])

  const openForm = useCallback(() => {
    setCollapsed(false)
    setShowForm(true)
    const suggested = Number(defaultAmount ?? 0)
    setAmountDraft(suggested > 0 ? suggested.toFixed(2) : '')
    setExpiryHours('72')
    setNotesDraft('')
  }, [defaultAmount])

  const createLink = useCallback(async () => {
    const amount = Number(amountDraft)
    if (!Number.isFinite(amount) || amount <= 0) {
      showMsg?.('Enter a deposit amount greater than 0.', 'error')
      return
    }
    setCreating(true)
    try {
      const body: Record<string, unknown> = { amount, purpose: 'DEPOSIT' }
      const hours = Number(expiryHours)
      if (Number.isFinite(hours) && hours > 0) body.expires_in_hours = Math.round(hours)
      if (notesDraft.trim()) body.notes = notesDraft.trim()

      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/payment-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg?.(json?.message ?? 'Failed to create payment link.', 'error')
        return
      }
      const created = json?.data?.payment_link as PosPaymentLink | undefined
      if (created) {
        setLinks((prev) => [created, ...prev])
        if (created.url) {
          try {
            await navigator.clipboard.writeText(created.url)
            setCopiedId(created.id)
            setTimeout(() => setCopiedId((prev) => (prev === created.id ? null : prev)), 2000)
            showMsg?.('Deposit link created and copied to clipboard.', 'success')
          } catch {
            showMsg?.('Deposit link created. Use Copy Link to share.', 'success')
          }
        } else {
          showMsg?.('Deposit link created.', 'success')
        }
      } else {
        showMsg?.('Deposit link created.', 'success')
      }
      setShowForm(false)
      setCollapsed(false)
    } finally {
      setCreating(false)
    }
  }, [amountDraft, bookingId, expiryHours, notesDraft, showMsg])

  const copyLink = useCallback(async (link: PosPaymentLink) => {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId((prev) => (prev === link.id ? null : prev)), 1500)
    } catch {
      showMsg?.('Unable to copy link. Copy it manually.', 'error')
    }
  }, [showMsg])

  const cancelLink = useCallback(async (link: PosPaymentLink) => {
    setActionId(link.id)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/payment-links/${link.id}/cancel`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg?.(json?.message ?? 'Failed to cancel payment link.', 'error')
        return
      }
      const updated = json?.data?.payment_link as PosPaymentLink | undefined
      if (updated) setLinks((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      showMsg?.('Payment link cancelled.', 'success')
    } finally {
      setActionId(null)
    }
  }, [bookingId, showMsg])

  const approveLink = useCallback(async (link: PosPaymentLink) => {
    setActionId(link.id)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/payment-links/${link.id}/approve`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg?.(json?.message ?? 'Failed to approve payment.', 'error')
        return
      }
      const updated = json?.data?.payment_link as PosPaymentLink | undefined
      if (updated) setLinks((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      showMsg?.('Payment confirmed and deposit recorded.', 'success')
      onDepositRecordedRef.current?.()
    } finally {
      setActionId(null)
    }
  }, [bookingId, showMsg])

  const rejectProof = useCallback(async (link: PosPaymentLink) => {
    setActionId(link.id)
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}/payment-links/${link.id}/reject-proof`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        showMsg?.(json?.message ?? 'Failed to reject payment proof.', 'error')
        return
      }
      const updated = json?.data?.payment_link as PosPaymentLink | undefined
      if (updated) setLinks((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      showMsg?.('Payment proof rejected. The customer can upload a new one.', 'success')
    } finally {
      setActionId(null)
    }
  }, [bookingId, showMsg])

  const paidCount = links.filter((link) => link.status === 'PAID').length
  const paidTotal = links
    .filter((link) => link.status === 'PAID')
    .reduce((sum, link) => sum + Number(link.amount ?? 0), 0)
  const actionNeededCount = links.filter(
    (link) => link.status === 'PENDING' && link.manual_review_status === 'slip_uploaded_pending_review',
  ).length

  const detailLink = detailLinkId != null ? links.find((link) => link.id === detailLinkId) ?? null : null
  const detailBusy = detailLink != null && actionId === detailLink.id
  const detailCanApprove = detailLink?.status === 'PENDING' && Boolean(detailLink.has_slip)
  const detailCanReject = detailLink?.status === 'PENDING' && Boolean(detailLink.has_slip)
  const detailPayer = detailLink ? resolvePayer(detailLink, bookingCustomer) : null
  const detailProofs =
    detailLink?.manual_slip_url
      ? [
          {
            url: detailLink.manual_slip_url,
            payment_method: detailLink.provider ?? 'manual_transfer',
            uploaded_at: detailLink.paid_at ?? detailLink.created_at ?? null,
          },
        ]
      : null

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 via-white to-purple-50/60 p-4 shadow-md ring-1 ring-purple-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={!collapsed}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-purple-900">Online Deposit History</span>
              {actionNeededCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {actionNeededCount} to review
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-gray-600">
              {links.length === 0
                ? 'Generate a payment link for the customer to pay a deposit online.'
                : `${links.length} link${links.length > 1 ? 's' : ''}${paidCount > 0 ? ` · ${paidCount} paid · RM ${paidTotal.toFixed(2)} collected` : ''}`}
            </p>
          </div>
          <svg
            className={`mt-1 h-5 w-5 shrink-0 text-purple-600 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {!showForm ? (
          <button
            type="button"
            disabled={disabled || creating}
            onClick={openForm}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Generate Link
          </button>
        ) : null}
      </div>

      {collapsed ? null : (
      <div className="mt-4 border-t border-purple-200/80 pt-4">

      {showForm ? (
        <div className="mb-4 space-y-3 rounded-lg border border-purple-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">Deposit amount</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">RM</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountDraft}
                  onChange={(e) => setAmountDraft(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm tabular-nums"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">Expires in (hours)</label>
              <input
                type="text"
                inputMode="numeric"
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm tabular-nums"
                placeholder="72"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">Note (optional)</label>
            <input
              type="text"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Internal reference"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={creating}
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creating || disabled}
              onClick={() => void createLink()}
              className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create Link'}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-gray-500">Loading payment links…</p>
      ) : links.length === 0 && !showForm ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-500">
          No payment links yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => {
            const canCancel = link.status === 'PENDING'
            const busy = actionId === link.id
            return (
              <li key={link.id} className="rounded-lg border border-white/80 bg-white px-3 py-2.5 text-xs shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums text-gray-900">RM {Number(link.amount ?? 0).toFixed(2)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[link.status]}`}>
                        {STATUS_LABEL[link.status]}
                      </span>
                      {link.status === 'PENDING' && link.manual_review_status === 'slip_uploaded_pending_review' ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                          Slip uploaded
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] leading-relaxed text-gray-600">
                        <span className="font-semibold text-gray-500">Generated</span>
                        {' · '}
                        {link.created_at ? formatDateTime12Hour(link.created_at) : '—'}
                        {link.created_by?.name ? (
                          <span className="text-gray-500">{` · ${link.created_by.name}`}</span>
                        ) : null}
                      </p>
                      {link.status === 'PENDING' && link.expires_at ? (
                        <p className="text-[11px] leading-relaxed text-gray-600">
                          <span className="font-semibold text-gray-500">Expires</span>
                          {' · '}
                          {formatDateTime12Hour(link.expires_at)}
                        </p>
                      ) : null}
                      {link.status === 'EXPIRED' && link.expires_at ? (
                        <p className="text-[11px] leading-relaxed text-gray-600">
                          <span className="font-semibold text-gray-500">Expired</span>
                          {' · '}
                          {formatDateTime12Hour(link.expires_at)}
                        </p>
                      ) : null}
                      {link.status === 'PAID' && link.paid_at ? (
                        <p className="text-[11px] leading-relaxed text-emerald-700">
                          <span className="font-semibold">Paid</span>
                          {' · '}
                          {formatDateTime12Hour(link.paid_at)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {link.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => void copyLink(link)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {copiedId === link.id ? 'Copied!' : 'Copy Link'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDetailLinkId(link.id)}
                      className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-800 hover:bg-purple-100"
                    >
                      View
                    </button>
                    {canCancel ? (
                      <button
                        type="button"
                        disabled={busy || disabled}
                        onClick={() => void cancelLink(link)}
                        className="rounded-md border border-rose-300 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Cancel'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      </div>
      )}

      {detailLink && typeof document !== 'undefined'
        ? createPortal(
            <PosModalShell
              size="md"
              zIndexClassName="z-[200]"
              overlayClassName="bg-black/60 backdrop-blur-sm"
              panelClassName="ring-1 ring-black/5"
              onClose={() => setDetailLinkId(null)}
              closeDisabled={detailBusy}
              header={
                <div className="relative overflow-hidden bg-gradient-to-br from-purple-800 via-purple-700 to-purple-900 px-5 py-5 text-white">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Payment link details</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                        RM {Number(detailLink.amount ?? 0).toFixed(2)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/20">
                          {STATUS_LABEL[detailLink.status]}
                        </span>
                        {detailLink.status === 'PENDING' && detailLink.manual_review_status === 'slip_uploaded_pending_review' ? (
                          <span className="rounded-full bg-blue-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Needs review
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={detailBusy}
                      onClick={() => setDetailLinkId(null)}
                      className="shrink-0 rounded-lg p-1.5 text-purple-100 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                      aria-label="Close"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              }
              footer={
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4">
                  {detailCanReject ? (
                    <button
                      type="button"
                      disabled={detailBusy || disabled}
                      onClick={() => void rejectProof(detailLink)}
                      className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm hover:bg-orange-50 disabled:opacity-50"
                    >
                      {detailBusy ? 'Working…' : 'Reject proof'}
                    </button>
                  ) : null}
                  {detailCanApprove ? (
                    <button
                      type="button"
                      disabled={detailBusy || disabled}
                      onClick={() => void approveLink(detailLink)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {detailBusy ? 'Working…' : 'Approve payment'}
                    </button>
                  ) : null}
                  {detailLink.status === 'PAID' && detailLink.receipt_url ? (
                    <a
                      href={detailLink.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
                    >
                      View receipt
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={detailBusy}
                    onClick={() => setDetailLinkId(null)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              }
            >
              <div className="space-y-5 px-5 py-5">
                <section>
                  <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Timeline</h4>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailInfoCell
                      label="Generated"
                      value={
                        <>
                          {detailLink.created_at ? formatDateTime12Hour(detailLink.created_at) : '—'}
                          {detailLink.created_by?.name ? (
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">by {detailLink.created_by.name}</span>
                          ) : null}
                        </>
                      }
                    />
                    {detailLink.expires_at && detailLink.status === 'PENDING' ? (
                      <DetailInfoCell label="Expires" value={formatDateTime12Hour(detailLink.expires_at)} />
                    ) : null}
                    {detailLink.status === 'EXPIRED' && detailLink.expires_at ? (
                      <DetailInfoCell label="Expired" value={formatDateTime12Hour(detailLink.expires_at)} />
                    ) : null}
                    {detailLink.paid_at ? (
                      <DetailInfoCell label="Paid" value={formatDateTime12Hour(detailLink.paid_at)} />
                    ) : null}
                    {detailLink.payment_ref ? (
                      <DetailInfoCell label="Payment reference" value={detailLink.payment_ref} />
                    ) : null}
                  </dl>
                </section>

                <section>
                  <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Payer</h4>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailInfoCell label="Name" value={detailPayer?.name || '—'} />
                    <DetailInfoCell label="Phone" value={detailPayer?.phone || '—'} />
                    <DetailInfoCell
                      label="Email"
                      value={
                        detailPayer?.email ? (
                          <span className="break-all">{detailPayer.email}</span>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <DetailInfoCell label="Payment method" value={formatLinkPaymentMethod(detailLink)} />
                  </dl>
                </section>

                {detailLink.manual_slip_url ? (
                  <section className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-r from-white to-amber-50/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment proof</p>
                      <p className="mt-0.5 text-sm text-slate-700">Transfer slip uploaded by the customer.</p>
                    </div>
                    <PaymentProofModal
                      proofs={detailProofs}
                      bookingCode={detailLink.payment_ref ?? bookingCode ?? null}
                      layout="icon"
                      overlayZIndexClass="z-[210]"
                      previewZIndexClass="z-[220]"
                      className="shrink-0"
                    />
                  </section>
                ) : null}
              </div>
            </PosModalShell>,
            document.body,
          )
        : null}
    </div>
  )
}
