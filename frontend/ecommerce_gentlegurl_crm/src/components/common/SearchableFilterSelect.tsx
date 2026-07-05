'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type SearchableFilterSelectOption = {
  value: string
  label: string
  searchText?: string
}

type SearchableFilterSelectProps = {
  value: string
  onChange: (value: string) => void
  options: SearchableFilterSelectOption[]
  allLabel?: string
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  searchPlaceholder?: string
  className?: string
  'aria-label'?: string
}

export default function SearchableFilterSelect({
  value,
  onChange,
  options,
  allLabel = 'All',
  loading = false,
  loadingLabel = 'Loading…',
  disabled = false,
  searchPlaceholder = 'Search…',
  className = '',
  'aria-label': ariaLabel,
}: SearchableFilterSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = options.find((option) => option.value === value)
  const triggerLabel = loading ? loadingLabel : selected?.label ?? allLabel

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const haystack = (option.searchText ?? option.label).toLowerCase()
      return haystack.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm transition-all hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate text-gray-900">{triggerLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto overscroll-contain py-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-800'}`}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                {allLabel}
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`flex w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-800'
                      }`}
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                    >
                      <span className="break-words">{option.label}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
