'use client'

import { FormEvent, useState } from 'react'

type CommissionRow = {
  id: number
  year: number
  month: number
  total_sales: string | number
  booking_count: number
  tier_percent: string | number
  commission_amount: string | number
  is_overridden: boolean
  override_amount?: string | number | null
  staff?: { id: number; name: string }
}

interface BookingCommissionOverrideModalProps {
  commission: CommissionRow
  onClose: () => void
  onSuccess: () => void
}

export default function BookingCommissionOverrideModal({
  commission,
  onClose,
  onSuccess,
}: BookingCommissionOverrideModalProps) {
  const [amount, setAmount] = useState(
    String(commission.override_amount ?? commission.commission_amount ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError('Invalid amount. Please enter a valid number.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commissions/${commission.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_overridden: true, override_amount: numAmount }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to override commission.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to override commission.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveOverride = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commissions/${commission.id}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_overridden: false, override_amount: null }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to remove override.')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove override.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {commission.is_overridden ? 'Edit Override Commission' : 'Override Commission'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Staff:</span> {commission.staff?.name ?? '-'}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Period:</span> {commission.year}-{String(commission.month).padStart(2, '0')}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Original Commission:</span> RM{' '}
                {Number(commission.commission_amount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="override_amount" className="text-xs font-semibold text-slate-500">
                Override Amount (RM)
              </label>
              <input
                id="override_amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
            <div>
              {commission.is_overridden && (
                <button
                  type="button"
                  onClick={handleRemoveOverride}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  Remove Override
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
