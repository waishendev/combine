'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import SalesVisualSummaryCards, { type SalesVisualSummaryData } from '@/components/reports/SalesVisualSummaryCards'

type Mode = 'ecommerce' | 'booking' | 'all'

type VisualPayload = SalesVisualSummaryData & {
  date?: string
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

const dayNavButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg leading-none text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900'

export default function SalesVisualDailyDashboard({
  mode,
  refreshKey = 0,
  onShiftDay,
  canViewStaffReport = false,
}: {
  mode: Mode
  refreshKey?: number
  onShiftDay?: (delta: number) => void
  canViewStaffReport?: boolean
}) {
  const searchParams = useSearchParams()
  const date = searchParams.get('date') ?? formatYmd(new Date())

  const [data, setData] = useState<VisualPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const path = mode === 'ecommerce' ? 'ecommerce' : mode === 'booking' ? 'booking' : 'all'
      const res = await fetch(`/api/proxy/ecommerce/reports/sales/visual-daily/${path}?date=${encodeURIComponent(date)}`, {
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
  }, [date, mode])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-center gap-2">
        {onShiftDay ? (
          <button type="button" onClick={() => onShiftDay(-1)} className={dayNavButtonClass} aria-label="Previous day">
            ‹
          </button>
        ) : null}
        <span className="min-w-[9.5rem] text-center text-base font-semibold text-slate-800">{formatDisplayDay(date)}</span>
        {onShiftDay ? (
          <button type="button" onClick={() => onShiftDay(1)} className={dayNavButtonClass} aria-label="Next day">
            ›
          </button>
        ) : null}
      </div>

      <SalesVisualSummaryCards mode={mode} loading={loading} error={error} data={data} periodScope="day" canViewStaffReport={canViewStaffReport} />
    </div>
  )
}
