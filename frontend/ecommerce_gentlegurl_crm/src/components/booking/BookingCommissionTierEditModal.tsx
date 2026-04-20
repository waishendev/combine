'use client'

import { FormEvent, useEffect, useState } from 'react'

import type { CommissionTierRow } from './BookingCommissionTierCreateModal'
import { useI18n } from '@/lib/i18n'

interface BookingCommissionTierEditModalProps {
  tierType: 'BOOKING' | 'ECOMMERCE'
  tier: CommissionTierRow
  onClose: () => void
  onSuccess: (tier: CommissionTierRow) => void
}

export default function BookingCommissionTierEditModal({
  tierType,
  tier,
  onClose,
  onSuccess,
}: BookingCommissionTierEditModalProps) {
  const { t } = useI18n()
  const [minSales, setMinSales] = useState('0')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMinSales(String(tier.min_sales ?? '0'))
    setCommissionPercent(String(tier.commission_percent ?? '0'))
  }, [tier])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const minSalesNum = Number(minSales)
    const percentNum = Number(commissionPercent)
    if (!Number.isFinite(minSalesNum) || minSalesNum < 0 || !Number.isFinite(percentNum) || percentNum < 0) {
      setError('Please enter valid values.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/commission-tiers/${tier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          type: tierType,
          min_sales: minSalesNum,
          commission_percent: percentNum,
        }),
      })

      const json = await res.json().catch(() => null)
      if (json && typeof json === 'object' && json?.success === false && json?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }
      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && typeof (json as { message?: unknown }).message === 'string'
            ? (json as { message: string }).message
            : 'Failed to update tier'
        setError(msg)
        return
      }

      const payload =
        json && typeof json === 'object' && 'data' in json && json.data && typeof json.data === 'object'
          ? (json.data as Partial<CommissionTierRow>)
          : null

      onSuccess({
        id: tier.id,
        min_sales: payload?.min_sales ?? minSalesNum,
        commission_percent: payload?.commission_percent ?? percentNum,
      })
    } catch {
      setError('Failed to update tier')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Edit Commission Tier</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.close')}
            disabled={submitting}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Min Sales</label>
            <input
              value={minSales}
              onChange={(e) => setMinSales(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Commission %</label>
            <input
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
              inputMode="decimal"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? t('common.saving') : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

