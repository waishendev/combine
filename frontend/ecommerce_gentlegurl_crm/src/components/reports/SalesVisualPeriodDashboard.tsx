'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import SalesVisualSummaryCards, { type SalesVisualSummaryData } from '@/components/reports/SalesVisualSummaryCards'

type SalesVisualPeriodDashboardProps = {
  year: number
  yearFrom?: number
  yearTo?: number
  month: number | null
  monthFrom?: number | null
  monthTo?: number | null
  onShiftPeriod?: (delta: number) => void
  canViewStaffReport?: boolean
}

type PeriodPayload = SalesVisualSummaryData & {
  period?: {
    year: number
    year_from?: number
    year_to?: number
    month: number | null
    month_from?: number | null
    month_to?: number | null
    mode: 'monthly' | 'yearly'
    label: string
  }
}

const periodNavButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900'

function monthShort(month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(2024, month - 1, 1))
}

function formatPeriodLabel(
  year: number,
  yearFrom: number,
  yearTo: number,
  month: number | null,
  monthFrom: number | null,
  monthTo: number | null,
) {
  if (monthFrom != null && monthTo != null) {
    if (monthFrom === monthTo) {
      return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, monthFrom - 1, 1))
    }
    return `${monthShort(monthFrom)} – ${monthShort(monthTo)} ${year}`
  }
  if (month) {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  }
  if (yearFrom !== yearTo) return `${yearFrom} – ${yearTo}`
  return String(yearFrom || year)
}

export default function SalesVisualPeriodDashboard({
  year,
  yearFrom,
  yearTo,
  month,
  monthFrom = null,
  monthTo = null,
  onShiftPeriod,
  canViewStaffReport = false,
}: SalesVisualPeriodDashboardProps) {
  const resolvedYearFrom = yearFrom ?? year
  const resolvedYearTo = yearTo ?? yearFrom ?? year
  const resolvedMonthFrom = monthFrom ?? month
  const resolvedMonthTo = monthTo ?? monthFrom ?? month

  const [data, setData] = useState<PeriodPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ year: String(year) })
      qs.set('year_from', String(resolvedYearFrom))
      qs.set('year_to', String(resolvedYearTo))
      if (resolvedMonthFrom != null) {
        qs.set('month', String(resolvedMonthFrom))
        qs.set('month_from', String(resolvedMonthFrom))
        qs.set('month_to', String(resolvedMonthTo ?? resolvedMonthFrom))
      }
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
  }, [resolvedMonthFrom, resolvedMonthTo, resolvedYearFrom, resolvedYearTo, year])

  useEffect(() => {
    void load()
  }, [load])

  const periodLabel = useMemo(
    () => data?.period?.label ?? formatPeriodLabel(
      year,
      resolvedYearFrom,
      resolvedYearTo,
      month,
      resolvedMonthFrom,
      resolvedMonthTo,
    ),
    [data?.period?.label, month, resolvedMonthFrom, resolvedMonthTo, resolvedYearFrom, resolvedYearTo, year],
  )

  const isRange = (resolvedMonthFrom != null && resolvedMonthTo != null && resolvedMonthFrom !== resolvedMonthTo)
    || (resolvedMonthFrom == null && resolvedYearFrom !== resolvedYearTo)
  const periodScope = resolvedMonthFrom != null ? 'month' : 'year'

  return (
    <section className="mb-6 space-y-4">
      <div className="flex items-center justify-center gap-2">
        {onShiftPeriod && !isRange ? (
          <button
            type="button"
            onClick={() => onShiftPeriod(-1)}
            className={periodNavButtonClass}
            aria-label={resolvedMonthFrom != null ? 'Previous month' : 'Previous year'}
          >
            ‹
          </button>
        ) : null}
        <span className="min-w-[9.5rem] text-center text-base font-semibold text-slate-800">{periodLabel}</span>
        {onShiftPeriod && !isRange ? (
          <button
            type="button"
            onClick={() => onShiftPeriod(1)}
            className={periodNavButtonClass}
            aria-label={resolvedMonthFrom != null ? 'Next month' : 'Next year'}
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
