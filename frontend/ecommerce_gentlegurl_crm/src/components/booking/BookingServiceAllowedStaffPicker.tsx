'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type BookingStaffOption = { id: number; name: string; store_location_ids?: number[] }

type BookingServiceAllowedStaffPickerProps = {
  staffOptions: BookingStaffOption[]
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  loading?: boolean
  /** Nested under a Branch card: use shorter “Staff” label. */
  compact?: boolean
}

type PanelStyle = {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

export default function BookingServiceAllowedStaffPicker({
  staffOptions,
  value,
  onChange,
  disabled = false,
  loading = false,
  compact = false,
}: BookingServiceAllowedStaffPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return staffOptions
    return staffOptions.filter((s) => s.name.toLowerCase().includes(q))
  }, [staffOptions, searchQuery])

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const maxHeight = 320
      const gap = 8
      const spaceBelow = window.innerHeight - rect.bottom - gap
      const spaceAbove = rect.top - gap
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16)
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)

      setPanelStyle({
        left,
        width,
        maxHeight: Math.max(160, Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)),
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, filteredStaff.length, value.length])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      return
    }
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => searchRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
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

  const allFilteredSelected =
    filteredStaff.length > 0 && filteredStaff.every((s) => value.includes(s.id))

  const listPanel = (
    <div
      ref={panelRef}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5"
      style={
        panelStyle
          ? {
              position: 'fixed',
              zIndex: 80,
              left: panelStyle.left,
              width: panelStyle.width,
              maxHeight: panelStyle.maxHeight,
              top: panelStyle.top,
              bottom: panelStyle.bottom,
              display: 'flex',
              flexDirection: 'column',
            }
          : undefined
      }
    >
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 p-3">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff…"
            disabled={loading || disabled}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          ) : null}
        </div>
      </div>

      {!loading && filteredStaff.length > 0 ? (
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            disabled={disabled}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {allFilteredSelected ? 'Deselect filtered' : 'Select all (filtered)'}
          </button>
          {value.length > 0 ? (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled}
              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading staff…</div>
        ) : filteredStaff.length > 0 ? (
          <div className="p-2">
            {filteredStaff.map((staff) => {
              const isSelected = value.includes(staff.id)
              return (
                <label
                  key={staff.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${
                    isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleId(staff.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={disabled}
                  />
                  <span className={isSelected ? 'font-medium' : ''}>{staff.name}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500">
            {searchQuery ? 'No staff match your search.' : 'No active staff at this Branch.'}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          {compact ? 'Staff' : 'Allowed Staff'} <span className="text-red-500">*</span>
        </label>
        <span className="text-xs text-gray-500">
          {loading ? 'Loading…' : `${value.length} selected`}
        </span>
      </div>

      {selectedStaff.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedStaff.map((staff) => (
            <span
              key={staff.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
            >
              <span className="truncate">{staff.name}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => toggleId(staff.id)}
                  className="rounded-full p-0.5 text-blue-600 hover:bg-blue-100 hover:text-blue-900"
                  aria-label={`Remove ${staff.name}`}
                >
                  <i className="fa-solid fa-xmark text-[10px]" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-700">Select at least one staff for this Branch.</p>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled || loading) return
          setOpen((o) => !o)
        }}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="text-gray-600">
          {open ? 'Close staff list' : value.length > 0 ? 'Edit staff selection' : 'Select staff'}
        </span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-xs text-gray-400`} />
      </button>

      {open && panelStyle && typeof document !== 'undefined'
        ? createPortal(listPanel, document.body)
        : null}
    </div>
  )
}
