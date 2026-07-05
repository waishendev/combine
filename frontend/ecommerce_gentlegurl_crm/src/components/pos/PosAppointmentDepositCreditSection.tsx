'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { formatDateTime12Hour } from '@/lib/formatDateTime'

import type { PosDepositTransaction } from './posAppointmentTypes'

type SplitPaymentMethod = 'cash' | 'qrpay' | 'credit_card'

const SPLIT_PAYMENT_METHODS: Array<{ method: SplitPaymentMethod; label: string }> = [
  { method: 'cash', label: 'Cash' },
  { method: 'qrpay', label: 'QRPay' },
  { method: 'credit_card', label: 'Credit Card' },
]

const EMPTY_SPLIT_PAYMENTS: Record<SplitPaymentMethod, string> = {
  cash: '',
  qrpay: '',
  credit_card: '',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  qrpay: 'QRPay',
  credit_card: 'Credit Card',
  billplz_credit_card: 'Credit Card',
  billplz_card: 'Credit Card',
  billplz_fpx: 'Online Banking',
  billplz_online_banking: 'Online Banking',
  manual_transfer: 'Manual Transfer',
  split: 'Split',
}

function formatPaymentMethodLabel(method?: string | null, payments?: Array<{ method?: string; amount?: number }>): string {
  const normalized = String(method ?? '').trim().toLowerCase()
  if (normalized === 'split' && payments?.length) {
    return payments
      .map((row) => `${PAYMENT_METHOD_LABELS[row.method ?? ''] ?? row.method ?? '—'} RM ${Number(row.amount ?? 0).toFixed(2)}`)
      .join(' · ')
  }
  return PAYMENT_METHOD_LABELS[normalized] ?? (normalized ? normalized.toUpperCase() : '—')
}

function splitRowsFromDraft(splitPayments: Record<SplitPaymentMethod, string>) {
  return SPLIT_PAYMENT_METHODS
    .map(({ method }) => ({ method, amount: Number(splitPayments[method] || 0) }))
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
}

type DepositFormMode =
  | { type: 'idle' }
  | { type: 'add' }
  | { type: 'edit'; transactionId: number }

type PosAppointmentDepositCreditSectionProps = {
  bookingId: number
  initialTransactions?: PosDepositTransaction[]
  initialTotal?: number
  onTotalChange?: (total: number) => void
  onAppointmentUpdated?: (payload: {
    deposit_transactions?: PosDepositTransaction[]
    deposit_total?: number
    balance_due?: number
    amount_due_now?: number
    appointment?: Record<string, unknown>
  }) => void
  onError?: (message: string | null) => void
  showMsg?: (message: string, type: 'success' | 'error') => void
  disabled?: boolean
}

export default function PosAppointmentDepositCreditSection({
  bookingId,
  initialTransactions,
  initialTotal,
  onTotalChange,
  onAppointmentUpdated,
  onError,
  showMsg,
  disabled = false,
}: PosAppointmentDepositCreditSectionProps) {
  const [transactions, setTransactions] = useState<PosDepositTransaction[]>(() => initialTransactions ?? [])
  const [depositTotal, setDepositTotal] = useState(() => Number(initialTotal ?? 0))
  const [loading, setLoading] = useState(() => initialTransactions === undefined && bookingId > 0)
  const onTotalChangeRef = useRef(onTotalChange)
  const onAppointmentUpdatedRef = useRef(onAppointmentUpdated)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onTotalChangeRef.current = onTotalChange
  }, [onTotalChange])

  useEffect(() => {
    onAppointmentUpdatedRef.current = onAppointmentUpdated
  }, [onAppointmentUpdated])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const [saving, setSaving] = useState(false)
  const [formMode, setFormMode] = useState<DepositFormMode>({ type: 'idle' })
  const [remarkDraft, setRemarkDraft] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<SplitPaymentMethod>('qrpay')
  const [splitPayments, setSplitPayments] = useState<Record<SplitPaymentMethod, string>>(EMPTY_SPLIT_PAYMENTS)

  useEffect(() => {
    if (initialTransactions !== undefined) {
      setTransactions(initialTransactions)
    }
  }, [bookingId, initialTransactions])

  useEffect(() => {
    if (!Number.isFinite(initialTotal)) return
    const total = Number(initialTotal)
    setDepositTotal(total)
    onTotalChangeRef.current?.(total)
  }, [initialTotal])

  const applyAppointmentDetailResponse = useCallback((data: Record<string, unknown> | null | undefined) => {
    if (!data) return

    const rows = (data.deposit_transactions ?? []) as PosDepositTransaction[]
    const total = Number(data.deposit_previously_collected_amount ?? data.deposit_contribution ?? 0)

    setTransactions(rows)
    setDepositTotal(total)
    onTotalChangeRef.current?.(total)
    onAppointmentUpdatedRef.current?.({
      deposit_transactions: rows,
      deposit_total: total,
      balance_due: Number(data.balance_due ?? 0),
      amount_due_now: Number(data.amount_due_now ?? 0),
      appointment: {
        ...(data.appointment as Record<string, unknown> | undefined),
        deposit_contribution: Number(data.deposit_contribution ?? total),
        deposit_previously_collected_amount: Number(data.deposit_previously_collected_amount ?? total),
        deposit_previously_collected: Boolean(data.deposit_previously_collected ?? total > 0.0001),
        deposit_paid: Number(data.deposit_paid ?? data.deposit_contribution ?? total),
        ...(Array.isArray(data.payment_history) ? { payment_history: data.payment_history } : {}),
        ...(Array.isArray(data.receipts) ? { receipts: data.receipts } : {}),
        ...(data.balance_due !== undefined ? { balance_due: Number(data.balance_due) } : {}),
        ...(data.amount_due_now !== undefined ? { amount_due_now: Number(data.amount_due_now) } : {}),
        ...(data.service_balance_due !== undefined ? { service_balance_due: data.service_balance_due } : {}),
        ...(data.settlement_paid !== undefined ? { settlement_paid: data.settlement_paid } : {}),
      },
    })
  }, [])

  const refreshDeposits = useCallback(async (options?: { silent?: boolean }) => {
    if (!bookingId) return
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const res = await fetch(`/api/proxy/pos/appointments/${bookingId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        onErrorRef.current?.(json?.message ?? 'Failed to load deposit transactions.')
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
    if (bookingId <= 0) return
    const silent = initialTransactions !== undefined
    void refreshDeposits({ silent })
  }, [bookingId, refreshDeposits])

  useEffect(() => {
    if (bookingId <= 0 || typeof document === 'undefined') return

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        void refreshDeposits({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityRefresh)
    window.addEventListener('focus', handleVisibilityRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityRefresh)
      window.removeEventListener('focus', handleVisibilityRefresh)
    }
  }, [bookingId, refreshDeposits])

  const editingTransaction = useMemo(
    () => (formMode.type === 'edit' ? transactions.find((row) => row.id === formMode.transactionId) ?? null : null),
    [formMode, transactions],
  )

  const splitPaymentRows = useMemo(() => splitRowsFromDraft(splitPayments), [splitPayments])
  const splitPaymentTotal = useMemo(
    () => splitPaymentRows.reduce((sum, row) => sum + row.amount, 0),
    [splitPaymentRows],
  )

  const resetForm = useCallback(() => {
    setFormMode({ type: 'idle' })
    setRemarkDraft('')
    setPaymentMethod('qrpay')
    setSplitPayments(EMPTY_SPLIT_PAYMENTS)
    onError?.(null)
  }, [onError])

  const openAddForm = useCallback(() => {
    onError?.(null)
    setFormMode({ type: 'add' })
    setRemarkDraft('')
    setPaymentMethod('qrpay')
    setSplitPayments(EMPTY_SPLIT_PAYMENTS)
  }, [onError])

  const openEditForm = useCallback((transaction: PosDepositTransaction) => {
    onError?.(null)
    setFormMode({ type: 'edit', transactionId: Number(transaction.id) })
    setRemarkDraft(String(transaction.remark ?? ''))
    const method = String(transaction.payment_method ?? 'qrpay').toLowerCase()
    const amount = Number(transaction.amount ?? 0)
    if (method === 'split' && transaction.payments?.length) {
      const nextSplit: Record<SplitPaymentMethod, string> = { ...EMPTY_SPLIT_PAYMENTS }
      transaction.payments.forEach((row) => {
        const key = row.method === 'billplz_credit_card' ? 'credit_card' : row.method
        if (key === 'cash' || key === 'qrpay' || key === 'credit_card') {
          nextSplit[key] = String(Number(row.amount ?? 0))
        }
      })
      setSplitPayments(nextSplit)
      setPaymentMethod('qrpay')
      return
    }

    const normalized = method === 'billplz_credit_card' ? 'credit_card' : method
    const activeMethod: SplitPaymentMethod = normalized === 'cash' || normalized === 'credit_card' ? normalized : 'qrpay'
    setPaymentMethod(activeMethod)
    setSplitPayments({
      cash: activeMethod === 'cash' ? String(amount) : '',
      qrpay: activeMethod === 'qrpay' ? String(amount) : '',
      credit_card: activeMethod === 'credit_card' ? String(amount) : '',
    })
  }, [onError])

  const buildPaymentPayload = useCallback((amount: number) => {
    const splitRows = splitRowsFromDraft(splitPayments)
    const splitTotal = splitRows.reduce((sum, row) => sum + row.amount, 0)
    if (splitRows.length > 1) {
      if (Math.abs(splitTotal - amount) > 0.009) {
        throw new Error(`Split payment must total RM ${amount.toFixed(2)}.`)
      }
      return { payments: splitRows }
    }
    if (splitRows.length === 1) {
      return { payments: splitRows }
    }
    if (amount > 0) {
      return { payments: [{ method: paymentMethod, amount }] }
    }
    return {}
  }, [paymentMethod, splitPayments])

  const applyMutationResponse = useCallback((json: { data?: Record<string, unknown> } | null) => {
    const data = json?.data ?? {}
    const rows = (data.deposit_transactions ?? []) as PosDepositTransaction[]
    const total = Number(data.deposit_total ?? rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))

    setTransactions(rows)
    setDepositTotal(total)
    onTotalChangeRef.current?.(total)
    onAppointmentUpdatedRef.current?.({
      deposit_transactions: rows,
      deposit_total: total,
      balance_due: Number(data.balance_due ?? 0),
      amount_due_now: Number(data.amount_due_now ?? 0),
      appointment: (data.appointment ?? undefined) as Record<string, unknown> | undefined,
    })
  }, [])

  const saveDeposit = useCallback(async () => {
    const amount = Math.max(0, splitPaymentTotal)
    if (amount <= 0) {
      onError?.('Enter at least one payment amount under Cash, QRPay, or Credit Card.')
      return
    }

    let paymentPayload: Record<string, unknown> = {}
    try {
      paymentPayload = buildPaymentPayload(amount)
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Invalid payment split.')
      return
    }

    setSaving(true)
    try {
      const body = {
        amount,
        remark: remarkDraft.trim() || null,
        ...paymentPayload,
      }
      const url = formMode.type === 'add'
        ? `/api/proxy/pos/appointments/${bookingId}/deposits`
        : `/api/proxy/pos/appointments/${bookingId}/deposits/${editingTransaction?.id}`
      const res = await fetch(url, {
        method: formMode.type === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        onError?.(json?.message ?? 'Failed to save deposit.')
        return
      }
      applyMutationResponse(json)
      resetForm()
      showMsg?.(formMode.type === 'add' ? 'Deposit added.' : 'Deposit updated.', 'success')
    } finally {
      setSaving(false)
    }
  }, [applyMutationResponse, bookingId, buildPaymentPayload, editingTransaction?.id, formMode.type, onError, remarkDraft, resetForm, showMsg, splitPaymentTotal])

  const showSplitFields = splitPaymentRows.length > 1

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Deposit Credit</label>
          <p className="mt-0.5 text-[11px] font-medium text-gray-500">
            Total credit applied toward settlement:{' '}
            <span className="font-semibold text-emerald-800">RM {depositTotal.toFixed(2)}</span>
          </p>
        </div>
        {formMode.type === 'idle' ? (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={openAddForm}
            className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            + Add Deposit
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading deposit transactions…</p>
      ) : transactions.length === 0 && formMode.type === 'idle' ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-500">
          No deposit transactions yet.
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
                    <span className="font-semibold tabular-nums text-gray-900">RM {Number(transaction.amount ?? 0).toFixed(2)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {formatPaymentMethodLabel(transaction.payment_method, transaction.payments)}
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
                  {transaction.is_grouped && transaction.label ? (
                    <p className="mt-0.5 text-[11px] font-medium text-gray-600">{transaction.label}</p>
                  ) : null}
                  <div className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                    {transaction.order_number ? (
                      <p className="font-mono text-slate-500">{transaction.order_number}</p>
                    ) : null}
                    {transaction.paid_at || transaction.created_at ? (
                      <p>{formatDateTime12Hour(transaction.paid_at ?? transaction.created_at)}</p>
                    ) : null}
                    {transaction.created_by?.name ? (
                      <p>{transaction.created_by.name}</p>
                    ) : null}
                    {!transaction.order_number && !transaction.paid_at && !transaction.created_at && !transaction.created_by?.name ? (
                      <p>—</p>
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
                      className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
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
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-800">
              {formMode.type === 'add' ? 'Add deposit payment' : 'Edit deposit transaction'}
            </p>
            <p className="text-xs font-semibold text-emerald-700">
              Total: RM {splitPaymentTotal.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Payment method</p>
            {!showSplitFields ? (
              <div className="flex flex-wrap gap-2">
                {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      onError?.(null)
                      setPaymentMethod(method)
                      const currentAmount = splitPayments[method] || splitPaymentRows[0]?.amount?.toFixed(2) || ''
                      setSplitPayments({
                        cash: method === 'cash' ? currentAmount : '',
                        qrpay: method === 'qrpay' ? currentAmount : '',
                        credit_card: method === 'credit_card' ? currentAmount : '',
                      })
                    }}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                      paymentMethod === method && !showSplitFields
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {SPLIT_PAYMENT_METHODS.map(({ method, label }) => (
                <div key={method}>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">RM</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={splitPayments[method]}
                      onChange={(e) => {
                        onError?.(null)
                        setSplitPayments((prev) => ({ ...prev, [method]: e.target.value }))
                      }}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-xs tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">Enter amount in one or more payment methods above.</p>
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
              disabled={saving || disabled || splitPaymentTotal <= 0}
              onClick={() => void saveDeposit()}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : formMode.type === 'add' ? 'Add Deposit' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
