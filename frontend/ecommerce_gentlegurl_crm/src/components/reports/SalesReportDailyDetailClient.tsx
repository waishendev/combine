'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import SalesChannelReportPage from '@/components/SalesChannelReportPage'
import SalesVisualDailyDashboard from '@/components/reports/SalesVisualDailyDashboard'

type Mode = 'ecommerce' | 'booking' | 'all'

function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYmd(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function formatDisplayDay(ymd: string) {
  const d = parseYmd(ymd)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function dateParts(ymd: string) {
  const d = parseYmd(ymd)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
  }
}

const segmentClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`

export default function SalesReportDailyDetailClient({ canExport }: { canExport: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didInit = useRef(false)
  const [visualRefreshKey, setVisualRefreshKey] = useState(0)

  const date = searchParams.get('date') ?? formatYmd(new Date())
  const parts = dateParts(date)
  const selectedYear = Number(searchParams.get('year') || parts.year)
  const selectedMonth = Number(searchParams.get('month') || parts.month)
  const monthTitle = useMemo(() => formatMonthTitle(selectedYear, selectedMonth), [selectedMonth, selectedYear])
  const displayDate = useMemo(() => formatDisplayDay(date), [date])

  const modeParam = searchParams.get('mode')
  const mode: Mode = modeParam === 'booking' ? 'booking' : modeParam === 'ecommerce' ? 'ecommerce' : 'all'

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const initialDate = searchParams.get('date') ?? date
    const initialParts = dateParts(initialDate)
    const q = new URLSearchParams(searchParams.toString())
    let changed = false

    if (!q.get('date')) {
      q.set('date', initialDate)
      changed = true
    }
    if (!q.get('year')) {
      q.set('year', String(initialParts.year))
      changed = true
    }
    if (!q.get('month')) {
      q.set('month', String(initialParts.month))
      changed = true
    }
    if (!q.get('mode')) {
      q.set('mode', 'all')
      changed = true
    }
    if (!q.get('date_from') || !q.get('date_to')) {
      q.set('date_from', initialDate)
      q.set('date_to', initialDate)
      if (!q.get('page')) q.set('page', '1')
      changed = true
    }
    if (q.get('mode') === 'all') {
      if (!q.get('ec_page')) {
        q.set('ec_page', '1')
        changed = true
      }
      if (!q.get('bk_page')) {
        q.set('bk_page', '1')
        changed = true
      }
    }

    if (changed) {
      router.replace(`${pathname}?${q.toString()}`)
    }
  }, [date, pathname, router, searchParams])

  useEffect(() => {
    const currentParts = dateParts(date)
    const from = searchParams.get('date_from')
    const to = searchParams.get('date_to')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (from === date && to === date && year === String(currentParts.year) && month === String(currentParts.month)) {
      return
    }

    const q = new URLSearchParams(searchParams.toString())
    q.set('date_from', date)
    q.set('date_to', date)
    q.set('year', String(currentParts.year))
    q.set('month', String(currentParts.month))
    router.replace(`${pathname}?${q.toString()}`)
  }, [date, pathname, router, searchParams])

  const setMode = (next: Mode) => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('mode', next)
    q.set('page', '1')
    if (next === 'all') {
      q.set('ec_page', '1')
      q.set('bk_page', '1')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const setDay = (next: string) => {
    const nextParts = dateParts(next)
    const q = new URLSearchParams(searchParams.toString())
    q.set('date', next)
    q.set('date_from', next)
    q.set('date_to', next)
    q.set('year', String(nextParts.year))
    q.set('month', String(nextParts.month))
    q.set('page', '1')
    if (mode === 'all') {
      q.set('ec_page', '1')
      q.set('bk_page', '1')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const shiftDay = (delta: number) => {
    const next = parseYmd(date)
    next.setDate(next.getDate() + delta)
    setDay(formatYmd(next))
  }

  const backToMonth = () => {
    const q = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
    router.push(`/reports/sales?${q.toString()}`)
  }

  const refreshVisualSummary = () => setVisualRefreshKey((prev) => prev + 1)

  const subtitle = `Ecommerce and booking sales detail for ${displayDate}.`

  return (
    <div className="overflow-y-auto px-6 py-6 lg:px-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs" aria-label="Breadcrumb">
        <span className="text-gray-500">Reports</span>
        <span className="text-gray-400">/</span>
        <button type="button" onClick={() => router.push('/reports/sales')} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
          Sales Report
        </button>
        <span className="text-gray-400">/</span>
        <button type="button" onClick={() => router.push(`/reports/sales?year=${selectedYear}`)} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
          {selectedYear}
        </button>
        <span className="text-gray-400">/</span>
        <button type="button" onClick={backToMonth} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
          {monthTitle.split(' ')[0]}
        </button>
        <span className="text-gray-400">/</span>
        <span className="font-medium text-gray-700">{displayDate}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <button
            type="button"
            onClick={backToMonth}
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Back to Month
          </button>
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Daily Sales Report</h2>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button type="button" onClick={() => setMode('all')} className={segmentClass(mode === 'all')}>
          All
        </button>
        <button type="button" onClick={() => setMode('ecommerce')} className={segmentClass(mode === 'ecommerce')}>
          Ecommerce
        </button>
        <button type="button" onClick={() => setMode('booking')} className={segmentClass(mode === 'booking')}>
          Booking
        </button>
      </div>

      <SalesVisualDailyDashboard mode={mode} refreshKey={visualRefreshKey} onShiftDay={shiftDay} />

      <h3 className="mb-4 text-lg font-semibold text-slate-800">Transactions</h3>
      {mode === 'all' ? (
        <div className="space-y-12">
          <section>
            <h4 className="text-base font-semibold text-slate-800">Ecommerce</h4>
            <p className="mb-3 text-xs text-slate-500">
              Product-line orders only. Booking deposits and other booking lines appear under Booking below.
            </p>
            <SalesChannelReportPage
              mode="ecommerce"
              canExport={canExport}
              defaultDatePreset="today"
              paramPrefix="ec_"
              isAllWorkspace
              showDateInputsInFilterModal={false}
              onDataChanged={refreshVisualSummary}
            />
          </section>
          <section>
            <h4 className="text-base font-semibold text-slate-800">Booking</h4>
            <p className="mb-3 text-xs text-slate-500">Deposits, settlement, add-ons, and packages — one row per booking line.</p>
            <SalesChannelReportPage
              mode="booking"
              canExport={canExport}
              defaultDatePreset="today"
              paramPrefix="bk_"
              isAllWorkspace
              showDateInputsInFilterModal={false}
              onDataChanged={refreshVisualSummary}
            />
          </section>
        </div>
      ) : (
        <SalesChannelReportPage
          mode={mode}
          canExport={canExport}
          defaultDatePreset="today"
          showDateInputsInFilterModal={false}
          onDataChanged={refreshVisualSummary}
        />
      )}
    </div>
  )
}
