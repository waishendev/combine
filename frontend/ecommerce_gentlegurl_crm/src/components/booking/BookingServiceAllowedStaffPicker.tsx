'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type BookingStaffOption = { id: number; name: string }

type BookingServiceAllowedStaffPickerProps = {
  staffOptions: BookingStaffOption[]
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  loading?: boolean
}

export default function BookingServiceAllowedStaffPicker({
  staffOptions,
  value,
  onChange,
  disabled = false,
  loading = false,
}: BookingServiceAllowedStaffPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return staffOptions
    return staffOptions.filter((s) => s.name.toLowerCase().includes(q))
  }, [staffOptions, searchQuery])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
    setSearchQuery('')
  }, [open])

  const toggleId = (id: number) => {
    if (disabled) return
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id))
    } else {
      onChange([...value, id])
    }
  }

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStaff.map((s) => s.id)
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => value.includes(id))
    if (allSelected) {
      onChange(value.filter((id) => !allFilteredIds.includes(id)))
    } else {
      const toAdd = allFilteredIds.filter((id) => !value.includes(id))
      onChange([...value, ...toAdd])
    }
  }

  const handleClearAll = () => {
    if (disabled) return
    onChange([])
  }

  const selectedStaff = useMemo(
    () => staffOptions.filter((s) => value.includes(s.id)),
    [staffOptions, value],
  )

  const triggerSummary = () => {
    if (value.length === 0) {
      return (
        <span className="flex items-center gap-2 text-gray-500">
          <i className="fa-solid fa-user-group text-xs" />
          Select allowed staff
        </span>
      )
    }
    if (value.length <= 2) {
      return (
        <span className="flex items-center gap-2 truncate text-gray-700">
          <i className="fa-solid fa-check-circle text-blue-600 text-xs" />
          {selectedStaff.map((s) => s.name).join(', ')}
        </span>
      )
    }
    return (
      <span className="flex items-center gap-2 text-gray-700">
        <i className="fa-solid fa-check-circle text-blue-600 text-xs" />
        <span className="font-medium">{value.length} staff selected</span>
      </span>
    )
  }

  const allFilteredSelected =
    filteredStaff.length > 0 && filteredStaff.every((s) => value.includes(s.id))

  return (
    <div ref={rootRef} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Allowed Staff <span className="text-red-500">*</span>
        {value.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({value.length} selected)
          </span>
        )}
      </label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => {
            if (disabled || loading) return
            setOpen((o) => !o)
          }}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-left text-sm shadow-sm transition-all duration-200 hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="min-w-0 flex-1">{triggerSummary()}</div>
          <i
            className={`fa-solid fa-chevron-${open ? 'up' : 'down'} flex-shrink-0 text-xs text-gray-400 transition-transform duration-200`}
          />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 bg-gray-50 p-3">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff…"
                  disabled={loading}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </div>
            </div>

            {!loading && filteredStaff.length > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-3 py-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  <i className="fa-solid fa-check-double" />
                  {allFilteredSelected ? 'Deselect filtered' : 'Select all (filtered)'}
                </button>
                {value.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 transition-colors hover:text-red-700"
                  >
                    <i className="fa-solid fa-trash-can" />
                    Clear all
                  </button>
                )}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <i className="fa-solid fa-spinner fa-spin mb-2 text-blue-600" />
                  <p className="text-sm text-gray-500">Loading staff…</p>
                </div>
              ) : filteredStaff.length > 0 ? (
                <div className="p-2">
                  {filteredStaff.map((staff) => {
                    const isSelected = value.includes(staff.id)
                    return (
                      <label
                        key={staff.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 transition-all duration-150 ${
                          isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleId(staff.id)}
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          disabled={disabled}
                        />
                        <span
                          className={`flex-1 text-sm ${isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}`}
                        >
                          {staff.name}
                        </span>
                        {isSelected && <i className="fa-solid fa-check-circle flex-shrink-0 text-xs text-blue-600" />}
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <i className="fa-solid fa-user-slash mb-2 text-2xl text-gray-300" />
                  <p className="text-sm text-gray-500">
                    {searchQuery ? 'No staff match your search.' : 'No active staff found.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
