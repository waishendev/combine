'use client'

import { useBranch } from '@/contexts/BranchContext'
import { branchSelectorOptions } from './branch-selector-options'

function Selector({ mobile }: { mobile: boolean }) {
  const { accessibleBranches, selectedBranchId, selectedBranch, loading, error, setSelectedBranch, refreshBranches } = useBranch()
  const hasMultiple = accessibleBranches.length > 1
  const options = branchSelectorOptions(accessibleBranches)
  const value = selectedBranchId === null ? 'all' : String(selectedBranchId)

  if (loading) {
    return <div className={`${mobile ? 'flex sm:hidden' : 'hidden sm:flex'} h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-500`}><i className="fa-solid fa-location-dot" /><span>{mobile ? 'Branch' : 'Loading branches...'}</span></div>
  }

  if (error) {
    return <button type="button" onClick={() => void refreshBranches()} title={error} className={`${mobile ? 'inline-flex sm:hidden' : 'hidden sm:inline-flex'} h-10 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700`}><i className="fa-solid fa-location-dot" /><span>{mobile ? 'Retry' : 'Branches unavailable'}</span></button>
  }

  if (accessibleBranches.length === 0) {
    return <div className={`${mobile ? 'flex sm:hidden' : 'hidden sm:flex'} h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-500`}><i className="fa-solid fa-location-dot" /><span>{mobile ? 'None' : 'No active branches'}</span></div>
  }

  return (
    <label className={`${mobile ? 'flex sm:hidden' : 'hidden sm:flex'} relative h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-slate-700 shadow-sm focus-within:border-pink-400`}>
      <i className="fa-solid fa-location-dot shrink-0 text-pink-500" aria-hidden="true" />
      <span className="sr-only">Current Branch</span>
      <select
        aria-label={mobile ? 'Current Branch (mobile)' : 'Current Branch'}
        value={value}
        disabled={!hasMultiple}
        onChange={(event) => setSelectedBranch(event.target.value === 'all' ? null : Number(event.target.value))}
        className={`${mobile ? 'max-w-[72px] text-xs' : 'max-w-[220px] text-sm'} min-w-0 appearance-none truncate bg-transparent py-2 pr-5 font-semibold outline-none disabled:cursor-default`}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {hasMultiple ? <i className="fa-solid fa-chevron-down pointer-events-none absolute right-2 text-[9px] text-slate-400" aria-hidden="true" /> : null}
      {!mobile ? <span className={`ml-1 hidden max-w-[190px] truncate rounded px-2 py-1 text-[10px] font-semibold lg:inline ${selectedBranch?.inventory_is_authoritative ? 'bg-emerald-100 text-emerald-800' : selectedBranch?.inventory_cutover_status === 'reconciled' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`} title={selectedBranch?.inventory_authority_label ?? 'Global legacy inventory authoritative'} aria-live="polite">{selectedBranch?.inventory_authority_label ?? 'Global stock active'}</span> : null}
    </label>
  )
}

export default function BranchSelector() {
  return <><Selector mobile /><Selector mobile={false} /></>
}
