'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { formatDateTime12Hour } from '@/lib/formatDateTime'

import type { PosPaymentLink, PosPaymentLinkStatus } from './posAppointmentTypes'

type PosAppointmentPaymentLinksSectionProps = {
  bookingId: number
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

export default function PosAppointmentPaymentLinksSection({
  bookingId,
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
  const [collapsed, setCollapsed] = useState(true)
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
      }
      setShowForm(false)
      showMsg?.('Deposit link created.', 'success')
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

  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0">
          <span className="text-xs font-semibold text-gray-700">Online Deposit History</span>
          <p className="mt-0.5 text-[11px] font-medium text-gray-500">
            {links.length === 0
              ? 'Generate a payment link for the customer to pay a deposit online.'
              : `${links.length} link${links.length > 1 ? 's' : ''}${paidCount > 0 ? ` · ${paidCount} paid · RM ${paidTotal.toFixed(2)} collected` : ''}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actionNeededCount > 0 ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
              {actionNeededCount} to review
            </span>
          ) : null}
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${collapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {collapsed ? null : (
      <div className="mt-3">
      <div className="mb-3 flex justify-end">
        {!showForm ? (
          <button
            type="button"
            disabled={disabled || creating}
            onClick={openForm}
            className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
          >
            + Generate Link
          </button>
        ) : null}
      </div>

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
            const canApprove = link.status === 'PENDING' && Boolean(link.has_slip)
            const canRejectProof = link.status === 'PENDING' && Boolean(link.has_slip)
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
                    <p className="mt-1 text-[11px] text-gray-600">
                      {link.created_at ? formatDateTime12Hour(link.created_at) : '—'}
                      {link.created_by?.name ? <span>{' · '}{link.created_by.name}</span> : null}
                      {link.expires_at && link.status === 'PENDING' ? (
                        <span>{' · Expires '}{formatDateTime12Hour(link.expires_at)}</span>
                      ) : null}
                    </p>
                    {link.payer?.name || link.payer?.phone || link.payer?.email ? (
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        Payer: {[link.payer?.name, link.payer?.phone, link.payer?.email].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {link.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => void copyLink(link)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {copiedId === link.id ? 'Copied!' : 'Copy'}
                      </button>
                    ) : null}
                    {link.manual_slip_url ? (
                      <a
                        href={link.manual_slip_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        Slip
                      </a>
                    ) : null}
                    {link.status === 'PAID' && link.receipt_url ? (
                      <a
                        href={link.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Receipt
                      </a>
                    ) : null}
                    {canApprove ? (
                      <button
                        type="button"
                        disabled={busy || disabled}
                        onClick={() => void approveLink(link)}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Approve'}
                      </button>
                    ) : null}
                    {canRejectProof ? (
                      <button
                        type="button"
                        disabled={busy || disabled}
                        onClick={() => void rejectProof(link)}
                        className="rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                      >
                        {busy ? '…' : 'Reject'}
                      </button>
                    ) : null}
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
    </div>
  )
}
