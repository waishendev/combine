'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import SalesChannelReportPage from '@/components/SalesChannelReportPage'
import SalesVisualDailyDashboard from '@/components/reports/SalesVisualDailyDashboard'

function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const segmentClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`

export default function SalesVisualWorkspaceClient({ canExport }: { canExport: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didInit = useRef(false)

  const modeParam = searchParams.get('mode')
  const mode: 'ecommerce' | 'booking' | 'all' =
    modeParam === 'booking' ? 'booking' : modeParam === 'ecommerce' ? 'ecommerce' : 'all'

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    const today = formatYmd(new Date())
    const q = new URLSearchParams(searchParams.toString())
    let changed = false
    if (!q.get('mode')) {
      q.set('mode', 'all')
      changed = true
    }
    if (!q.get('date_from') || !q.get('date_to')) {
      const d = q.get('date') ?? today
      q.set('date', d)
      q.set('date_from', d)
      q.set('date_to', d)
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
  }, [pathname, router, searchParams])

  /** In ALL workspace, transaction tables use the same day as the header (`date` query). */
  useEffect(() => {
    if (mode !== 'all') return
    const d = searchParams.get('date')
    if (!d) return
    const from = searchParams.get('date_from')
    const to = searchParams.get('date_to')
    if (from === d && to === d) return
    const q = new URLSearchParams(searchParams.toString())
    q.set('date_from', d)
    q.set('date_to', d)
    router.replace(`${pathname}?${q.toString()}`)
  }, [mode, pathname, router, searchParams])

  const setMode = (next: 'ecommerce' | 'booking' | 'all') => {
    const q = new URLSearchParams(searchParams.toString())
    q.set('mode', next)
    q.set('page', '1')
    if (next === 'all') {
      q.set('ec_page', '1')
      q.set('bk_page', '1')
    }
    router.push(`${pathname}?${q.toString()}`)
  }

  const subtitle =
    mode === 'ecommerce'
      ? 'Product orders and channel split — daily cards and transaction table.'
      : mode === 'booking'
        ? 'Booking lines, deposits, settlement, packages — daily cards and transaction table.'
        : 'Ecommerce and booking combined — daily cards and both transaction tables.'

  return (
    <div className="overflow-y-auto py-6 px-6 lg:px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Sales report</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Sales report</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
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
        </div>
      </div>

      <SalesVisualDailyDashboard mode={mode} />

      <h3 className="text-lg font-semibold text-slate-800 mb-4">Transactions</h3>
      {mode === 'all' ? (
        <div className="space-y-12">
          <section>
            <h4 className="text-base font-semibold text-slate-800">Ecommerce</h4>
            <p className="mb-3 text-xs text-slate-500">
              Product-line orders only. Booking deposits and other booking lines appear under Booking below (same as POS rows with
              booking line types).
            </p>
            <SalesChannelReportPage mode="ecommerce" canExport={canExport} defaultDatePreset="today" paramPrefix="ec_" isAllWorkspace />
          </section>
          <section>
            <h4 className="text-base font-semibold text-slate-800">Booking</h4>
            <p className="mb-3 text-xs text-slate-500">Deposits, settlement, add-ons, and packages — one row per booking line.</p>
            <SalesChannelReportPage mode="booking" canExport={canExport} defaultDatePreset="today" paramPrefix="bk_" isAllWorkspace />
          </section>
        </div>
      ) : (
        <SalesChannelReportPage mode={mode} canExport={canExport} defaultDatePreset="today" />
      )}
    </div>
  )
}
