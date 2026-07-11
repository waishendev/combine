'use client'

import { useCallback, useEffect, useState } from 'react'

import SalesVisualSummaryCards, { type SalesVisualSummaryData } from '@/components/reports/SalesVisualSummaryCards'

type SalesVisualPeriodDashboardProps = {
  year: number
  month: number | null
  onShiftPeriod?: (delta: number) => void
  canViewStaffReport?: boolean
}

type PeriodPayload = SalesVisualSummaryData & {
  period?: {
    year: number
    month: number | null
    mode: 'monthly' | 'yearly'
    label: string
  }
}

const periodNavButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900'

function formatPeriodLabel(year: number, month: number | null) {
  if (month) {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }
  return String(year)
}

export default function SalesVisualPeriodDashboard({ year, month, onShiftPeriod, canViewStaffReport = false }: SalesVisualPeriodDashboardProps) {
  const [data, setData] = useState<PeriodPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ year: String(year) })
      if (month) qs.set('month', String(month))
      const res = await fetch(`/api/proxy/ecommerce/reports/sales/visual-period/all?${qs.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setData(null)
        setError('Unable to load period summary.')
        return
      }
      setData((await res.json()) as PeriodPayload)
    } catch {
      setData(null)
      setError('Unable to load period summary.')
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    void load()
  }, [load])

  const periodLabel = data?.period?.label ?? formatPeriodLabel(year, month)
  const periodScope = month ? 'month' : 'year'

  return (
    <section className="mb-6 space-y-4">
      <div className="flex items-center justify-center gap-2">
        {onShiftPeriod ? (
          <button
            type="button"
            onClick={() => onShiftPeriod(-1)}
            className={periodNavButtonClass}
            aria-label={month ? 'Previous month' : 'Previous year'}
          >
            ‹
          </button>
        ) : null}
        <span className="min-w-[9.5rem] text-center text-base font-semibold text-slate-800">{periodLabel}</span>
        {onShiftPeriod ? (
          <button
            type="button"
            onClick={() => onShiftPeriod(1)}
            className={periodNavButtonClass}
            aria-label={month ? 'Next month' : 'Next year'}
          >
            ›
          </button>
        ) : null}
      </div>

      <SalesVisualSummaryCards
        mode="all"
        loading={loading}
        error={error}
        data={data}
        periodScope={periodScope}
        canViewStaffReport={canViewStaffReport}
      />
    </section>
  )
}
