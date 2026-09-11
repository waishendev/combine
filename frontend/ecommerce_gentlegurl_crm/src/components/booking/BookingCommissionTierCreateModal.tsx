'use client'

import { FormEvent, useState } from 'react'

import { useI18n } from '@/lib/i18n'
import CrmFormModalShell from '@/components/CrmFormModalShell'

export type CommissionTierRow = {
  id: number
  min_sales: string | number
  commission_percent: string | number
  store_location_id?: number | null
  store_location?: { id: number; name: string } | null
}

/** Keep Commission % in 0–100; values above 100 auto-clamp to 100. */
export function clampCommissionPercentInput(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.') return trimmed
  // Allow in-progress typing like "10." without forcing a number yet.
  if (/^\d+\.$/.test(trimmed)) {
    const whole = Number(trimmed.slice(0, -1))
    if (!Number.isFinite(whole)) return ''
    if (whole > 100) return '100'
    if (whole < 0) return '0'
    return trimmed
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return ''
  if (n > 100) return '100'
  if (n < 0) return '0'
  return trimmed
}

export function clampCommissionPercentValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

interface BookingCommissionTierCreateModalProps {
  tierType: 'BOOKING' | 'ECOMMERCE'
  onClose: () => void
  onSuccess: (tier: CommissionTierRow) => void
  defaultStoreLocationId: number | null
  branchOptions: Array<{ id: number; name: string }>
}

export default function BookingCommissionTierCreateModal({
  tierType,
  onClose,
  onSuccess,
  defaultStoreLocationId,
  branchOptions,
}: BookingCommissionTierCreateModalProps) {
  const { t } = useI18n()
  const [minSales, setMinSales] = useState('0')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storeLocationId, setStoreLocationId] = useState(defaultStoreLocationId ? String(defaultStoreLocationId) : '')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const minSalesNum = Number(minSales)
    const percentNum = clampCommissionPercentValue(Number(commissionPercent))
    setCommissionPercent(String(percentNum))
    if (!storeLocationId) {
      setError('Branch is required.')
      return
    }
    if (!Number.isFinite(minSalesNum) || minSalesNum < 0 || !Number.isFinite(percentNum)) {
      setError('Please enter valid values.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/commission-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          type: tierType,
          min_sales: minSalesNum,
          commission_percent: percentNum,
          store_location_id: Number(storeLocationId),
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
            : 'Failed to create tier'
        setError(msg)
        return
      }

      const payload =
        json && typeof json === 'object' && 'data' in json && json.data && typeof json.data === 'object'
          ? (json.data as Partial<CommissionTierRow>)
          : null

      onSuccess({
        id: Number(payload?.id ?? 0),
        min_sales: payload?.min_sales ?? minSalesNum,
        commission_percent: payload?.commission_percent ?? percentNum,
      })
    } catch {
      setError('Failed to create tier')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Create Commission Tier"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
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
            form="commission-tier-create-form"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="commission-tier-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="commission-tier-branch">Branch <span className="text-red-500">*</span></label>
            <select id="commission-tier-branch" value={storeLocationId} onChange={(event) => setStoreLocationId(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" disabled={submitting || defaultStoreLocationId !== null}>
              <option value="">Select branch</option>
              {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Min Sales</label>
            <input
              value={minSales}
              onChange={(e) => setMinSales(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="commission-tier-create-percent">
              Commission %
            </label>
            <input
              id="commission-tier-create-percent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(clampCommissionPercentInput(e.target.value))}
              onBlur={() => setCommissionPercent(String(clampCommissionPercentValue(Number(commissionPercent || 0))))}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={submitting}
              inputMode="decimal"
              placeholder="0"
            />
          </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
      </form>
    </CrmFormModalShell>
  )
}
