'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import SalesVisualSummaryCards, { type SalesVisualSummaryData } from '@/components/reports/SalesVisualSummaryCards'
import { useBranch } from '@/contexts/BranchContext'

type Mode = 'ecommerce' | 'booking' | 'all'

type VisualPayload = SalesVisualSummaryData & {
  date?: string
  date_from?: string
  date_to?: string
  points_redemption?: { message?: string | null }
  service_consumed?: { amount?: number; message?: string | null }
}

function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDay(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

function normalizeRange(from: string, to: string) {
  if (!from && !to) {
    const today = formatYmd(new Date())
    return { from: today, to: today }
  }
  if (!from) return { from: to, to }
  if (!to) return { from, to: from }
  if (from <= to) return { from, to }
  return { from: to, to: from }
}

const dayNavButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900'

export default function SalesVisualDailyDashboard({
  mode,
  refreshKey = 0,
  onShiftDay,
  canViewStaffReport = false,
  includeVoid = false,
}: {
  mode: Mode
  refreshKey?: number
  onShiftDay?: (delta: number) => void
  canViewStaffReport?: boolean
  includeVoid?: boolean
}) {
  const { selectedBranchId } = useBranch()
  const searchParams = useSearchParams()
  const today = useMemo(() => formatYmd(new Date()), [])
  const range = useMemo(() => {
    const rawFrom = searchParams.get('date_from') || searchParams.get('date') || today
    const rawTo = searchParams.get('date_to') || searchParams.get('date_from') || searchParams.get('date') || today
    return normalizeRange(rawFrom, rawTo)
  }, [searchParams, today])

  const dateFrom = range.from
  const dateTo = range.to
  const isSingleDay = dateFrom === dateTo

  const [data, setData] = useState<VisualPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const path = mode === 'ecommerce' ? 'ecommerce' : mode === 'booking' ? 'booking' : 'all'
      const qs = new URLSearchParams({
        date: dateFrom,
        date_from: dateFrom,
        date_to: dateTo,
      })
      if (includeVoid) qs.set('include_void', 'true')
      if (selectedBranchId === null) qs.set('branch_scope', 'all')
      else qs.set('branch_store_location_id', String(selectedBranchId))
      const res = await fetch(`/api/proxy/ecommerce/reports/sales/visual-daily/${path}?${qs.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setData(null)
        setError('Unable to load visual summary.')
        return
      }
      setData((await res.json()) as VisualPayload)
    } catch {
      setData(null)
      setError('Unable to load visual summary.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, includeVoid, mode, selectedBranchId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const periodLabel = isSingleDay
    ? formatDisplayDay(dateFrom)
    : `${formatDisplayDay(dateFrom)} – ${formatDisplayDay(dateTo)}`

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-center gap-2">
        {onShiftDay && isSingleDay ? (
          <button type="button" onClick={() => onShiftDay(-1)} className={dayNavButtonClass} aria-label="Previous day">
            ‹
          </button>
        ) : null}
        <span className="min-w-[9.5rem] text-center text-base font-semibold text-slate-800">{periodLabel}</span>
        {onShiftDay && isSingleDay ? (
          <button type="button" onClick={() => onShiftDay(1)} className={dayNavButtonClass} aria-label="Next day">
            ›
          </button>
        ) : null}
      </div>

      <SalesVisualSummaryCards
        mode={mode}
        loading={loading}
        error={error}
        data={data}
        periodScope={isSingleDay ? 'day' : 'month'}
        canViewStaffReport={canViewStaffReport}
      />
    </div>
  )
}
