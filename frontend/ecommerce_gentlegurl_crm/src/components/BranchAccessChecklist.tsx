'use client'

import { toggleBranchId } from './branch-access-selection'

export type BranchAccessOption = { id: number; name: string; code?: string; is_active?: boolean }

export default function BranchAccessChecklist({
  id,
  options,
  selectedIds,
  disabled,
  onChange,
}: {
  id: string
  options: BranchAccessOption[]
  selectedIds: string[]
  disabled?: boolean
  onChange: (ids: string[]) => void
}) {
  return (
    <fieldset id={id} className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-gray-300 p-2">
      <legend className="sr-only">Branch access choices</legend>
      {options.length === 0 ? <p className="px-2 py-3 text-sm text-gray-500">No accessible Branches available.</p> : null}
      {options.map((location) => {
        const checked = selectedIds.includes(String(location.id))
        return (
          <label key={location.id} className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 text-sm hover:bg-slate-50 has-[:checked]:bg-blue-50">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => onChange(toggleBranchId(selectedIds, location.id, event.target.checked))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span>
              <span className="font-medium text-gray-800">{location.name}</span>
              {location.code ? <span className="text-gray-500"> ({location.code})</span> : null}
              {location.is_active === false ? <span className="text-amber-700"> — inactive</span> : null}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
