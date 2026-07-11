'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFilterModalShell from '@/components/CrmFilterModalShell'

type StaffSalesPayload = {
  range?: {
    date_from: string
    date_to: string
  }
  staff?: {
    staff_id: number
    name: string
    product_sales: number
    service_amount: number
    service_count: number
  }
}

const fmtRm = (n: number) =>
  `RM ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDisplayDate = (dateString: string) => {
  if (!dateString) return '—'
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const getDefaultRange = () => {
  const today = formatDateInput(new Date())
  return { from: today, to: today }
}

function StatSkeleton() {
  return <div className="mt-4 h-10 w-32 animate-pulse rounded-lg bg-slate-200" />
}

export default function StaffMySalesDashboard() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [filterInputs, setFilterInputs] = useState(defaultRange)
  const [appliedFilters, setAppliedFilters] = useState(defaultRange)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [data, setData] = useState<StaffSalesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        date_from: appliedFilters.from,
        date_to: appliedFilters.to,
      })
      const res = await fetch(`/api/proxy/ecommerce/reports/my-staff-sales?${qs.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setData(null)
        setError(res.status === 403 ? 'This account is not linked to a staff profile.' : 'Unable to load sales summary.')
        return
      }
      setData((await res.json()) as StaffSalesPayload)
    } catch {
      setData(null)
      setError('Unable to load sales summary.')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters.from, appliedFilters.to])

  useEffect(() => {
    void load()
  }, [load])

  const applyRange = (range: { from: string; to: string }) => {
    setFilterInputs(range)
    setAppliedFilters(range)
    setIsFilterOpen(false)
  }

  const handleApplyFilter = () => {
    applyRange({
      from: filterInputs.from || defaultRange.from,
      to: filterInputs.to || defaultRange.to,
    })
  }

  const handleReset = () => {
    applyRange(defaultRange)
  }

  const staff = data?.staff
  const showingRange =
    appliedFilters.from === appliedFilters.to
      ? formatDisplayDate(appliedFilters.from)
      : `${formatDisplayDate(appliedFilters.from)} – ${formatDisplayDate(appliedFilters.to)}`

  return (
    <div className="space-y-6">
      {isFilterOpen ? (
        <CrmFilterModalShell
          title="Filter"
          onClose={() => setIsFilterOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilter}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                Apply Filter
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Date From</label>
              <input
                type="date"
                value={filterInputs.from}
                onChange={(e) => setFilterInputs((prev) => ({ ...prev, from: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500">Date To</label>
              <input
                type="date"
                value={filterInputs.to}
                onChange={(e) => setFilterInputs((prev) => ({ ...prev, to: e.target.value }))}
                className="h-10 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm"
              />
            </div>
          </div>
        </CrmFilterModalShell>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterInputs(appliedFilters)
            setIsFilterOpen(true)
          }}
          className="flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          disabled={loading}
        >
          <i className="fa-solid fa-filter" aria-hidden />
          Filter
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
          <span className="font-medium">Date Range</span>
          <span>{showingRange}</span>
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800"
            onClick={handleReset}
            aria-label="Reset date filter"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <i className="fa-solid fa-bag-shopping text-base" aria-hidden />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Ecommerce</p>
              <p className="mt-1 text-sm text-slate-500">Product sales</p>
            </div>
          </div>
          {loading ? (
            <StatSkeleton />
          ) : (
            <p className="mt-5 text-4xl font-bold tracking-tight text-slate-900">{fmtRm(staff?.product_sales ?? 0)}</p>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <i className="fa-solid fa-spa text-base" aria-hidden />
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Services</p>
              <p className="mt-1 text-sm text-slate-500">Completed bookings + booking products</p>
            </div>
            {!loading ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                {staff?.service_count ?? 0}×
              </span>
            ) : null}
          </div>
          {loading ? (
            <StatSkeleton />
          ) : (
            <>
              <p className="mt-5 text-4xl font-bold tracking-tight text-slate-900">{fmtRm(staff?.service_amount ?? 0)}</p>
              <p className="mt-2 text-sm text-slate-500">{staff?.service_count ?? 0} services completed</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
