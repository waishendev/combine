'use client'

import { useBranch } from '@/contexts/BranchContext'
import { branchSelectorOptions } from './branch-selector-options'

export default function BranchSelector() {
  const { accessibleBranches, selectedBranchId, loading, error, setSelectedBranch, refreshBranches } = useBranch()
  const hasMultiple = accessibleBranches.length > 1
  const options = branchSelectorOptions(accessibleBranches)
  const value = selectedBranchId === null ? 'all' : String(selectedBranchId)

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch</p>
        <div className="mt-2 flex h-10 items-center gap-2 text-sm text-slate-500">
          <i className="fa-solid fa-location-dot text-pink-400" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={() => void refreshBranches()}
        title={error}
        className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600">Branch</p>
        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
          <i className="fa-solid fa-location-dot" aria-hidden="true" />
          <span>Retry loading branches</span>
        </div>
      </button>
    )
  }

  if (accessibleBranches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <i className="fa-solid fa-location-dot text-slate-400" aria-hidden="true" />
          <span>No active branches</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-3 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Branch</p>
      <label className="relative mt-2 flex min-h-[44px] w-full touch-manipulation items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-800 shadow-sm focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-100">
        <i className="fa-solid fa-location-dot shrink-0 text-pink-500" aria-hidden="true" />
        <span className="sr-only">Current branch</span>
        <select
          aria-label="Current branch"
          value={value}
          disabled={!hasMultiple}
          onChange={(event) => setSelectedBranch(event.target.value === 'all' ? null : Number(event.target.value))}
          className="min-w-0 flex-1 appearance-none truncate bg-transparent py-2.5 pr-5 text-sm font-semibold outline-none disabled:cursor-default"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {hasMultiple ? (
          <i
            className="fa-solid fa-chevron-down pointer-events-none absolute right-2.5 text-[10px] text-slate-400"
            aria-hidden="true"
          />
        ) : null}
      </label>
    </div>
  )
}
