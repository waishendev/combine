'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { formatDateTime12Hour } from '@/lib/formatDateTime'

import type { PosRefundTransaction } from './posAppointmentTypes'

type RefundMethod = 'cash' | 'customer_credit'

const REFUND_METHODS: Array<{ method: RefundMethod; label: string; hint?: string }> = [
  { method: 'cash', label: 'Cash Refund' },
  { method: 'customer_credit', label: 'Customer Credit', hint: 'Refund to Customer Balance' },
]

type RefundFormMode =
  | { type: 'idle' }
  | { type: 'add' }
  | { type: 'edit'; transactionId: number }

type PosAppointmentRefundCreditSectionProps = {
  bookingId: number
  memberId?: number | null
  memberName?: string | null
  refundNeeded?: number
  initialTransactions?: PosRefundTransaction[]
  onAppointmentUpdated?: (payload: {
    refund_transactions?: PosRefundTransaction[]
    overpaid_amount?: number
    refund_needed?: number
    refund_handled?: boolean
    refund_handled_amount?: number
    balance_due?: number
    amount_due_now?: number
    appointment?: Record<string, unknown>
  }) => void
  onError?: (message: string | null) => void
  showMsg?: (message: string, type: 'success' | 'error') => void
  disabled?: boolean
}

export default function PosAppointmentRefundCreditSection({
  bookingId,
  memberId = null,
  memberName = null,
  refundNeeded = 0,
  initialTransactions,
  onAppointmentUpdated,
  onError,
  showMsg,
  disabled = false,
}: PosAppointmentRefundCreditSectionProps) {
  const [transactions, setTransactions] = useState<PosRefundTransaction[]>(() => initialTransactions ?? [])
  const [pendingRefund, setPendingRefund] = useState(() => Math.max(0, Number(refundNeeded ?? 0)))
  const [loading, setLoading] = useState(() => initialTransactions === undefined && bookingId > 0)
  const [memberWalletBalance, setMemberWalletBalance] = useState<number | null>(null)
  const onAppointmentUpdatedRef = useRef(onAppointmentUpdated)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onAppointmentUpdatedRef.current = onAppointmentUpdated
  }, [onAppointmentUpdated])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const [saving, setSaving] = useState(false)
  const [formMode, setFormMode] = useState<RefundFormMode>({ type: 'idle' })
  const [remarkDraft, setRemarkDraft] = useState('')
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash')
  const [amountDraft, setAmountDraft] = useState('')

  const refreshMemberWallet = useCallback(async () => {
    if (!memberId) {
      setMemberWalletBalance(null)
      return
    }
    try {
      const res = await fetch(`/api/proxy/admin/customers/${memberId}/wallet`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setMemberWalletBalance(null)
        return
      }
      setMemberWalletBalance(Number(json?.data?.wallet_balance ?? 0))
    } catch {
      setMemberWalletBalance(null)
    }
  }, [memberId])

  useEffect(() => {
    void refreshMemberWallet()
  }, [refreshMemberWallet])

  useEffect(() => {
    if (!memberId && refundMethod === 'customer_credit' && formMode.type === 'add') {
      setRefundMethod('cash')
    }
  }, [formMode.type, memberId, refundMethod])

  useEffect(() => {
    if (initialTransactions !== undefined) {
      setTransactions(initialTransactions)
    }
  }, [bookingId, initialTransactions])

  useEffect(() => {
    setPendingRefund(Math.max(0, Number(refundNeeded ?? 0)))
  }, [refundNeeded])

  const handledTotal = useMemo(
    () => transactions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
    [transactions],
  )

  const editingTransaction = useMemo(
    () => (formMode.type === 'edit' ? transactions.find((row) => row.id === formMode.transactionId) ?? null : null),
    [formMode, transactions],
  )

  const maxEditableAmount = useMemo(() => {
    if (formMode.type === 'edit' && editingTransaction) {
      return pendingRefund + Number(editingTransaction.amount ?? 0)
    }
    return pendingRefund
  }, [editingTransaction, formMode.type, pendingRefund])

  const applyAppointmentDetailResponse = useCallback((data: Record<string, unknown> | null | undefined) => {
    if (!data) return

    const rows = (data.refund_transactions ?? []) as PosRefundTransaction[]
    setTransactions(rows)
    setPendingRefund(Math.max(0, Number(data.refund_needed ?? 0)))
    onAppointmentUpdatedRef.current?.({
      refund_transactions: rows,
      overpaid_amount: Number(data.overpaid_amount ?? 0),
      refund_needed: Number(data.refund_needed ?? 0),
      refund_handled: Boolean(data.refund_handled ?? false),
      refund_handled_amount: Number(data.refund_handled_amount ?? 0),
      balance_due: Number(data.balance_due ?? 0),
      amount_due_now: Number(data.amount_due_now ?? 0),
      appointment: (data.appointment ?? undefined) as Record<string, unknown> | undefined,
    })
  }, [])

  const refreshRefunds = useCallback(async (options?: { silent?: boolean }) => {
    if (!bookingId) return
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        onErrorRef.current?.(json?.message ?? 'Failed to load refund transactions.')
        return
      }
      applyAppointmentDetailResponse((json?.data ?? null) as Record<string, unknown> | null)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [applyAppointmentDetailResponse, bookingId])

  useEffect(() => {
    if (bookingId <= 0 || initialTransactions !== undefined) return
    void refreshRefunds()
  }, [bookingId, initialTransactions, refreshRefunds])

  const resetForm = useCallback(() => {
    setFormMode({ type: 'idle' })
    setRemarkDraft('')
    setRefundMethod('cash')
    setAmountDraft('')
    onError?.(null)
  }, [onError])

  const openAddForm = useCallback(() => {
    onError?.(null)
    setFormMode({ type: 'add' })
    setRemarkDraft('')
    setRefundMethod('cash')
    setAmountDraft(pendingRefund > 0 ? pendingRefund.toFixed(2) : '')
  }, [onError, pendingRefund])

  const openEditForm = useCallback((transaction: PosRefundTransaction) => {
    onError?.(null)
    const method = String(transaction.method ?? 'cash').toLowerCase()
    setFormMode({ type: 'edit', transactionId: Number(transaction.id) })
    setRemarkDraft(String(transaction.remark ?? ''))
    setRefundMethod(method === 'customer_credit' ? 'customer_credit' : 'cash')
    setAmountDraft(Number(transaction.amount ?? 0).toFixed(2))
  }, [onError])

  const saveRefund = useCallback(async () => {
    const amount = Math.max(0, Number(amountDraft || 0))
    if (amount <= 0) {
      onError?.('Enter a refund or customer credit amount.')
      return
    }
    if (amount > maxEditableAmount + 0.009) {
      onError?.(`Amount cannot exceed RM ${maxEditableAmount.toFixed(2)}.`)
      return
    }
    if (refundMethod === 'customer_credit' && !memberId) {
      onError?.('Customer Credit is only available for Members.')
      return
    }

    setSaving(true)
    try {
      const body = {
        amount,
        method: refundMethod,
        remark: remarkDraft.trim() || null,
      }
      const url = formMode.type === 'add'
        ? `/api/proxy/pos/appointments/${bookingId}/refunds`
        : `/api/proxy/pos/appointments/${bookingId}/refunds/${editingTransaction?.id}`
      const res = await fetch(url, {
        method: formMode.type === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        onError?.(json?.message ?? 'Failed to save refund.')
        if (memberId) {
          void refreshMemberWallet()
        }
        return
      }
      applyAppointmentDetailResponse((json?.data ?? null) as Record<string, unknown> | null)
      resetForm()
      if (memberId) {
        void refreshMemberWallet()
      }
      showMsg?.(formMode.type === 'add' ? 'Refund recorded.' : 'Refund updated.', 'success')
    } finally {
      setSaving(false)
    }
  }, [amountDraft, applyAppointmentDetailResponse, bookingId, editingTransaction?.id, formMode.type, maxEditableAmount, memberId, onError, refreshMemberWallet, refundMethod, remarkDraft, resetForm, showMsg])

  const showSection = pendingRefund > 0.0001 || transactions.length > 0 || formMode.type !== 'idle'
  if (!showSection) {
    return null
  }

  return (
    <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Refund / Customer Credit</label>
          <p className="mt-0.5 text-[11px] font-medium text-gray-500">
            {pendingRefund > 0.0001 ? (
              <>
                Overpaid amount pending:{' '}
                <span className="font-semibold text-rose-800">RM {pendingRefund.toFixed(2)}</span>
              </>
            ) : (
              <>
                Total refunded / credited:{' '}
                <span className="font-semibold text-emerald-800">RM {handledTotal.toFixed(2)}</span>
              </>
            )}
          </p>
        </div>
        {formMode.type === 'idle' && pendingRefund > 0.0001 ? (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={openAddForm}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            + Add Refund
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading refund transactions…</p>
      ) : transactions.length === 0 && formMode.type === 'idle' ? (
        <p className="rounded-lg border border-dashed border-rose-200 bg-white px-3 py-4 text-center text-xs text-gray-500">
          No refund transactions yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="rounded-lg border border-white/80 bg-white px-3 py-2.5 text-xs shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums text-rose-800">− RM {Number(transaction.amount ?? 0).toFixed(2)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {transaction.method_label ?? transaction.method ?? 'Refund'}
                    </span>
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        transaction.channel === 'online'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-amber-100 text-amber-800',
                      ].join(' ')}
                    >
                      {transaction.channel === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                    {transaction.refund_no ? (
                      <p className="font-mono text-slate-500">{transaction.refund_no}</p>
                    ) : null}
                    {transaction.processed_at || transaction.created_at ? (
                      <p>{formatDateTime12Hour(transaction.processed_at ?? transaction.created_at)}</p>
                    ) : null}
                    {transaction.created_by?.name ? (
                      <p>{transaction.created_by.name}</p>
                    ) : null}
                  </div>
                  {transaction.remark ? (
                    <p className="mt-1 text-[11px] italic text-gray-500">{transaction.remark}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {transaction.receipt_public_url ? (
                    <a
                      href={transaction.receipt_public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      Receipt
                    </a>
                  ) : null}
                  {formMode.type === 'idle' ? (
                    <button
                      type="button"
                      disabled={disabled || saving}
                      onClick={() => openEditForm(transaction)}
                      className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formMode.type !== 'idle' ? (
        <div className="mt-4 space-y-3 rounded-lg border border-rose-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-800">
              {formMode.type === 'add' ? 'Add refund / customer credit' : 'Edit refund transaction'}
            </p>
            <p className="text-xs font-semibold text-rose-700">
              Total: RM {Number(amountDraft || 0).toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Refund option</p>
            {memberId ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
                <p><span className="font-semibold">Member</span> · {memberName || `Member #${memberId}`}</p>
                <p className="mt-0.5">
                  <span className="font-semibold">Customer Balance</span> · Available RM {(memberWalletBalance ?? 0).toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">Customer Credit is only available for Members.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {REFUND_METHODS.map(({ method, label, hint }) => {
                const creditDisabled = method === 'customer_credit' && !memberId
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={creditDisabled}
                    onClick={() => {
                      if (creditDisabled) return
                      onError?.(null)
                      setRefundMethod(method)
                    }}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                      creditDisabled
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                        : refundMethod === method
                          ? 'border-rose-500 bg-rose-50 text-rose-800'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <span className="block">{label}</span>
                    {hint ? <span className="mt-0.5 block text-[10px] font-medium opacity-80">{hint}</span> : null}
                  </button>
                )
              })}
            </div>
            {refundMethod === 'customer_credit' && memberId ? (
              <p className="text-[11px] font-semibold text-emerald-700">
                This amount will be added to Customer Balance.
              </p>
            ) : null}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Amount</label>
              <div className="relative max-w-xs">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">RM</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountDraft}
                  onChange={(e) => {
                    onError?.(null)
                    setAmountDraft(e.target.value)
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-xs tabular-nums"
                  placeholder="0.00"
                />
              </div>
              {maxEditableAmount > 0 ? (
                <p className="mt-1 text-[11px] text-gray-500">Maximum: RM {maxEditableAmount.toFixed(2)}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Remark (optional)</label>
            <input
              type="text"
              value={remarkDraft}
              onChange={(e) => {
                onError?.(null)
                setRemarkDraft(e.target.value)
              }}
              placeholder="Reason for adjustment"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || disabled || Number(amountDraft || 0) <= 0 || (refundMethod === 'customer_credit' && !memberId)}
              onClick={() => void saveRefund()}
              className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : formMode.type === 'add' ? 'Add Refund' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
