'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { BookingProductCategory } from './bookingProductTypes'

type Props = {
  categories: BookingProductCategory[]
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  label?: string
  required?: boolean
}

export default function BookingProductCategoriesPicker({
  categories,
  value,
  onChange,
  disabled = false,
  label = 'Categories',
  required = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(
    () => categories.filter((c) => c.is_active).slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories],
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((c) => c.name.toLowerCase().includes(q))
  }, [sorted, searchQuery])

  const selected = useMemo(() => sorted.filter((s) => value.includes(s.id)), [sorted, value])

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
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange([...value, id])
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
        >
          <span className="truncate text-gray-700">
            {selected.length === 0
              ? 'Select categories'
              : selected.length <= 2
                ? selected.map((s) => s.name).join(', ')
                : `${selected.length} categories selected`}
          </span>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-xs text-gray-400`} />
        </button>

        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 bg-gray-50 p-3">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.map((category) => {
                const checked = value.includes(category.id)
                return (
                  <label key={category.id} className={`flex items-center gap-3 rounded-lg p-2.5 ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleId(category.id)} disabled={disabled} />
                    <span className={`text-sm ${checked ? 'font-medium text-blue-900' : 'text-gray-700'}`}>{category.name}</span>
                  </label>
                )
              })}
              {filtered.length === 0 && <p className="p-3 text-sm text-gray-500">No categories found.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
