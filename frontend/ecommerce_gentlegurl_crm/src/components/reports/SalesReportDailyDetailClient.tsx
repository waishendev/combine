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

function addDays(ymd: string, delta: number) {
  const next = parseYmd(ymd)
  next.setDate(next.getDate() + delta)
  return formatYmd(next)
}

const filterInputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const segmentClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`

export default function SalesReportDailyDetailClient({ canExport, canViewStaffReport = false }: { canExport: boolean; canViewStaffReport?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didInit = useRef(false)
  const [visualRefreshKey, setVisualRefreshKey] = useState(0)
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')

  const today = useMemo(() => formatYmd(new Date()), [])
  const appliedRange = useMemo(() => {
    const rawFrom = searchParams.get('date_from') || searchParams.get('date') || today
    const rawTo = searchParams.get('date_to') || searchParams.get('date_from') || searchParams.get('date') || today
    return normalizeRange(rawFrom, rawTo)
  }, [searchParams, today])

  const dateFrom = appliedRange.from
  const dateTo = appliedRange.to
  const isSingleDay = dateFrom === dateTo
  const focusParts = dateParts(dateFrom)
  const selectedYear = Number(searchParams.get('year') || focusParts.year)
  const selectedMonth = Number(searchParams.get('month') || focusParts.month)
  const monthTitle = useMemo(() => formatMonthTitle(selectedYear, selectedMonth), [selectedMonth, selectedYear])
  const rangeLabel = useMemo(() => {
    if (isSingleDay) return formatDisplayDay(dateFrom)
    return `${formatDisplayDay(dateFrom)} – ${formatDisplayDay(dateTo)}`
  }, [dateFrom, dateTo, isSingleDay])

  const modeParam = searchParams.get('mode')
  const mode: Mode = modeParam === 'booking' ? 'booking' : modeParam === 'ecommerce' ? 'ecommerce' : 'all'

  useEffect(() => {
    setDraftFrom(dateFrom)
    setDraftTo(dateTo)
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const initialDate = searchParams.get('date') || searchParams.get('date_from') || today
    const initialFrom = searchParams.get('date_from') || initialDate
    const initialTo = searchParams.get('date_to') || searchParams.get('date_from') || initialDate
    const range = normalizeRange(initialFrom, initialTo)
    const parts = dateParts(range.from)
    const q = new URLSearchParams(searchParams.toString())
    let changed = false

    if (!q.get('date')) {
      q.set('date', range.from)
      changed = true
    }
    if (!q.get('date_from') || !q.get('date_to')) {
      q.set('date_from', range.from)
      q.set('date_to', range.to)
      changed = true
    }
    if (!q.get('year')) {
      q.set('year', String(parts.year))
      changed = true
    }
    if (!q.get('month')) {
      q.set('month', String(parts.month))
      changed = true
    }
    if (!q.get('mode')) {
      q.set('mode', 'all')
      changed = true
    }
    if (!q.get('page')) {
      q.set('page', '1')
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
  }, [pathname, router, searchParams, today])

  const pushRange = (from: string, to: string) => {
    const range = normalizeRange(from, to)
    const parts = dateParts(range.from)
    const q = new URLSearchParams(searchParams.toString())
    q.set('date', range.from)
    q.set('date_from', range.from)
    q.set('date_to', range.to)
    q.set('year', String(parts.year))
    q.set('month', String(parts.month))
    q.set('page', '1')
    if (mode === 'all') {
      q.set('ec_page', '1')
      q.set('bk_page', '1')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

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

  const applyDateFilter = () => {
    pushRange(draftFrom || dateFrom, draftTo || dateTo)
  }

  const resetToToday = () => {
    setDraftFrom(today)
    setDraftTo(today)
    pushRange(today, today)
  }

  const shiftDay = (delta: number) => {
    if (!isSingleDay) return
    const next = addDays(dateFrom, delta)
    pushRange(next, next)
  }

  const backToMonth = () => {
    const q = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
    router.push(`/reports/sales?${q.toString()}`)
  }

  const refreshVisualSummary = () => setVisualRefreshKey((prev) => prev + 1)

  const subtitle = isSingleDay
    ? `Ecommerce and booking sales detail for ${rangeLabel}.`
    : `Ecommerce and booking sales detail from ${formatDisplayDay(dateFrom)} to ${formatDisplayDay(dateTo)}.`

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
        <span className="font-medium text-gray-700">{rangeLabel}</span>
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
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              From
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                className={filterInputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              To
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                className={filterInputClass}
              />
            </label>
            <button
              type="button"
              onClick={applyDateFilter}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetToToday}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Today
            </button>
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

      <SalesVisualDailyDashboard
        mode={mode}
        refreshKey={visualRefreshKey}
        onShiftDay={isSingleDay ? shiftDay : undefined}
        canViewStaffReport={canViewStaffReport}
      />

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
