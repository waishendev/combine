'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type BookingServiceLinkedOption = {
  id: number
  name: string
  duration_min: number
  service_price: number
}

type Props = {
  label?: string
  options: BookingServiceLinkedOption[]
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export default function BookingServiceLinkedBookingServicePicker({
  label = 'Linked Booking Service',
  options,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => {
    if (!value) return null
    return options.find((s) => String(s.id) === value) ?? null
  }, [options, value])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter((s) => {
      const name = s.name.toLowerCase()
      const id = String(s.id)
      return name.includes(q) || id.includes(q)
    })
  }, [options, searchQuery])

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

  const triggerText = selected
    ? `${selected.name} (${selected.duration_min} min, RM${Number(selected.service_price || 0).toFixed(2)})`
    : 'Select linked booking service'

  return (
    <div ref={rootRef} className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          className="flex w-full items-center justify-between rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={`min-w-0 flex-1 truncate ${selected ? 'text-gray-900' : 'text-gray-500'}`}>
            {triggerText}
          </span>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ml-2 text-xs text-gray-400`} />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 bg-gray-50 p-2.5">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services…"
                  className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                {(searchQuery || value) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery) setSearchQuery('')
                      if (value) onChange('')
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear"
                    title="Clear"
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="p-5 text-center text-sm text-gray-500">
                  {searchQuery ? 'No services match your search.' : 'No services found.'}
                </div>
              ) : (
                filtered.map((service) => {
                  const isSelected = String(service.id) === value
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        onChange(String(service.id))
                        setOpen(false)
                      }}
                      className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                        isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-800'
                      }`}
                    >
                      <span className="flex-1">
                        <span className="font-medium">{service.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({service.duration_min} min, RM{Number(service.service_price || 0).toFixed(2)})
                        </span>
                      </span>
                      {isSelected && <i className="fa-solid fa-check-circle mt-0.5 text-xs text-blue-600" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

