'use client'

import { useState } from 'react'

import CrmFormModalShell from './CrmFormModalShell'
import type { CustomerRowData } from './CustomerRow'

type BalanceDirection = 'credit' | 'debit'

type Props = {
  customer: CustomerRowData
  canAdjust: boolean
  onClose: () => void
  onSuccess: (walletBalance: number) => void
}

export default function CustomerAdjustBalanceModal({
  customer,
  canAdjust,
  onClose,
  onSuccess,
}: Props) {
  const [direction, setDirection] = useState<BalanceDirection>('credit')
  const [amount, setAmount] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDeposit = direction === 'credit'
  const currentBalance = customer.walletBalance ?? 0
  const parsedAmount = Number(amount || 0)
  const previewBalance =
    currentBalance + (isDeposit ? parsedAmount : -parsedAmount)

  const handleSubmit = async () => {
    if (!canAdjust) return

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }

    if (!remark.trim()) {
      setError('Remark is required.')
      return
    }

    if (!isDeposit && parsedAmount > currentBalance) {
      setError(`Insufficient balance. Available: RM ${currentBalance.toFixed(2)}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/admin/customers/${customer.id}/wallet/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          direction,
          amount,
          remark: remark.trim(),
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          json?.message ?? `${isDeposit ? 'Deposit' : 'Withdraw'} failed.`,
        )
      }

      const nextBalance = Number(json?.data?.wallet_balance ?? 0)
      onSuccess(Number.isFinite(nextBalance) ? nextBalance : currentBalance)
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update wallet balance.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Adjust Balance"
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <>
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          {canAdjust ? (
            <button
              type="button"
              className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                isDeposit
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting
                ? 'Saving...'
                : isDeposit
                  ? 'Confirm Deposit'
                  : 'Confirm Withdraw'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-gray-600">
          Customer: <span className="font-medium text-gray-900">{customer.name}</span>
        </p>
        <p className="text-sm text-gray-600">
          Current balance:{' '}
          <span className="font-semibold text-emerald-700">
            RM {currentBalance.toFixed(2)}
          </span>
        </p>

        {!canAdjust ? (
          <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-gray-500">
            You do not have permission to deposit or withdraw. Use View History for wallet details.
          </p>
        ) : (
          <>
            {error && (
              <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <p className="mb-2 block text-sm font-medium text-gray-700">
                Adjustment type <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setDirection('credit')
                    setError(null)
                  }}
                  className={`rounded border px-3 py-2 text-sm font-semibold transition ${
                    isDeposit
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fa-solid fa-plus mr-1.5" aria-hidden="true" />
                  Deposit
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setDirection('debit')
                    setError(null)
                  }}
                  className={`rounded border px-3 py-2 text-sm font-semibold transition ${
                    !isDeposit
                      ? 'border-rose-600 bg-rose-50 text-rose-800'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fa-solid fa-minus mr-1.5" aria-hidden="true" />
                  Withdraw
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (RM) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
                placeholder="e.g. 100.00"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Remark <span className="text-red-500">*</span>
              </label>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
                placeholder="e.g. Manual top-up / Correction"
                disabled={submitting}
              />
            </div>

            {parsedAmount > 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Current RM {currentBalance.toFixed(2)}
                {' · '}
                {isDeposit ? 'Deposit +' : 'Withdraw −'}RM {parsedAmount.toFixed(2)}
                {' · '}
                New balance{' '}
                <span className="font-semibold">RM {previewBalance.toFixed(2)}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </CrmFormModalShell>
  )
}
