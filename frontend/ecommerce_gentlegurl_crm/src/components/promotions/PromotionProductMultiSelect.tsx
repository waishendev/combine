'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { ProductOption } from './promotionUtils'

interface PromotionProductMultiSelectProps {
  products: ProductOption[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  isReadOnly?: boolean
}

function ProductThumb({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-gray-400">
        <i className="fa-solid fa-image text-xs" aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      className="h-9 w-9 shrink-0 rounded-md border border-gray-200 object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export default function PromotionProductMultiSelect({
  products,
  selectedIds,
  onChange,
  disabled = false,
  isReadOnly = false,
}: PromotionProductMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const locked = disabled || isReadOnly

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const selectableInFilter = useMemo(
    () => filtered.filter((p) => !p.disabled),
    [filtered],
  )

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const count = selectedIds.length

  const summaryText = useMemo(() => {
    if (count === 0) return 'Select products…'
    const names = products
      .filter((p) => selectedSet.has(p.id))
      .map((p) => p.name)
    const joined = names.join(', ')
    return joined.length > 72 ? `${joined.slice(0, 69)}…` : joined
  }, [count, products, selectedSet])

  const toggle = (product: ProductOption) => {
    if (locked || product.disabled) return
    const on = selectedSet.has(product.id)
    if (on) {
      onChange(selectedIds.filter((id) => id !== product.id))
    } else {
      onChange([...selectedIds, product.id])
    }
  }

  const selectAllFiltered = () => {
    if (locked) return
    const next = new Set(selectedIds)
    selectableInFilter.forEach((p) => next.add(p.id))
    onChange(Array.from(next))
  }

  const clearAll = () => {
    if (locked) return
    onChange([])
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <label className="text-sm font-medium text-gray-700">
          Products <span className="text-red-500">*</span>
        </label>
        {count > 0 ? (
          <span className="text-xs text-gray-500">({count} selected)</span>
        ) : null}
      </div>

      <button
        type="button"
        disabled={locked}
        onClick={() => {
          if (!locked) setOpen((o) => !o)
        }}
        className={`flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm transition hover:border-gray-400 ${
          locked ? 'cursor-not-allowed bg-gray-50 opacity-80' : ''
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {count > 0 ? (
          <i className="fa-solid fa-circle-check shrink-0 text-blue-600" aria-hidden />
        ) : (
          <i className="fa-solid fa-box shrink-0 text-gray-400" aria-hidden />
        )}
        <span
          className={`min-w-0 flex-1 truncate ${count === 0 ? 'text-gray-500' : 'text-gray-900'}`}
        >
          {summaryText}
        </span>
        <i
          className={`fa-solid shrink-0 text-gray-500 ${open ? 'fa-chevron-up' : 'fa-chevron-down'}`}
          aria-hidden
        />
      </button>

      {open && !locked ? (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={selectableInFilter.length === 0}
              className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="fa-solid fa-check-double" aria-hidden />
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={count === 0}
              className="inline-flex items-center gap-1.5 font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="fa-solid fa-trash-can" aria-hidden />
              Clear all
            </button>
          </div>

          <ul
            className="max-h-56 overflow-y-auto py-1"
            role="listbox"
            aria-multiselectable
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-gray-500">
                No products match your search.
              </li>
            ) : (
              filtered.map((product) => {
                const selected = selectedSet.has(product.id)
                const itemDisabled = product.disabled
                return (
                  <li key={product.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      disabled={itemDisabled}
                      onClick={() => toggle(product)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                        itemDisabled
                          ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                          : selected
                            ? 'bg-blue-50 text-gray-900 hover:bg-blue-100/80'
                            : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        tabIndex={-1}
                        checked={selected}
                        disabled={itemDisabled}
                        className="pointer-events-none h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600"
                      />
                      <ProductThumb
                        src={product.cover_image_url}
                        name={product.name}
                      />
                      <span className="min-w-0 flex-1 truncate font-normal">
                        {product.name}
                      </span>
                      {selected && !itemDisabled ? (
                        <i
                          className="fa-solid fa-circle-check shrink-0 text-blue-600"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                    {itemDisabled && product.disabled_reason ? (
                      <p className="px-3 pb-2 pl-[3.25rem] text-xs text-amber-700">
                        {product.disabled_reason}
                      </p>
                    ) : null}
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
