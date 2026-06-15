'use client'

import { useState } from 'react'

import type { CustomerRowData } from './CustomerRow'

type AdjustAction = 'add' | 'reduce'

type Props = {
  customer: CustomerRowData
  action: AdjustAction
  onClose: () => void
  onSuccess: (availablePoints: number) => void
}

export default function CustomerAdjustPointsModal({
  customer,
  action,
  onClose,
  onSuccess,
}: Props) {
  const [points, setPoints] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdd = action === 'add'
  const title = isAdd ? 'Add Member Points' : 'Reduce Member Points'

  const handleSubmit = async () => {
    const parsedPoints = Number(points)
    if (!Number.isFinite(parsedPoints) || parsedPoints < 1) {
      setError('Points must be at least 1.')
      return
    }

    if (!isAdd && customer.availablePoints != null && parsedPoints > customer.availablePoints) {
      setError(`Insufficient points. Available: ${customer.availablePoints}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/customers/${customer.id}/points-adjustment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          points: parsedPoints,
          remark: remark.trim() || null,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json?.message ||
          (Array.isArray(json?.errors?.points) ? json.errors.points[0] : null) ||
          'Unable to update member points.'
        throw new Error(message)
      }

      const availablePoints = Number(json?.data?.available_points ?? json?.available_points)
      onSuccess(Number.isFinite(availablePoints) ? availablePoints : customer.availablePoints ?? 0)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update member points.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">
          Customer: <span className="font-medium text-gray-900">{customer.name}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Current points:{' '}
          <span className="font-semibold text-indigo-600">
            {customer.availablePoints != null ? customer.availablePoints.toLocaleString() : '—'}
          </span>
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Points <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={1}
          step={1}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
          placeholder={isAdd ? 'e.g. 100' : 'e.g. 50'}
          disabled={submitting}
        />

        <label className="mt-4 block text-sm font-medium text-gray-700">Remark (optional)</label>
        <textarea
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
          placeholder="e.g. Birthday bonus / Manual correction"
          disabled={submitting}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              isAdd ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isAdd ? 'Add Points' : 'Reduce Points'}
          </button>
        </div>
      </div>
    </div>
  )
}
