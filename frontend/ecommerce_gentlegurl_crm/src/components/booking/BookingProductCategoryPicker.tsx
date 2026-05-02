'use client'

import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import type { BookingProductCategory } from './bookingProductTypes'

type Props = {
  categories: BookingProductCategory[]
  value: string
  onChange: (categoryId: string) => void
  disabled?: boolean
  placeholder?: string
  emptyLabel?: string
}

/** Scroll containers that can move the trigger without firing window scroll. */
function getScrollParents(el: HTMLElement | null): HTMLElement[] {
  const parents: HTMLElement[] = []
  let cur: HTMLElement | null = el?.parentElement ?? null
  while (cur && cur !== document.body) {
    const style = getComputedStyle(cur)
    const ox = style.overflowX
    const oy = style.overflowY
    if (/(auto|scroll|overlay)/.test(ox) || /(auto|scroll|overlay)/.test(oy)) {
      parents.push(cur)
    }
    cur = cur.parentElement
  }
  parents.push(document.documentElement)
  return parents
}

const EST_MENU_HEIGHT_PX = 280
const MOBILE_SHEET_MQ = '(max-width: 639px)'

function useMobileCategorySheet(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(MOBILE_SHEET_MQ)
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(MOBILE_SHEET_MQ).matches,
    () => false,
  )
}

export default function BookingProductCategoryPicker({
  categories,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search category…',
  emptyLabel = 'No category',
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const useSheet = useMobileCategorySheet()

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => c.is_active)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories],
  )

  const selected = useMemo(() => {
    if (!value) return null
    const id = Number(value)
    return sorted.find((c) => c.id === id) ?? null
  }, [sorted, value])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((c) => c.name.toLowerCase().includes(q))
  }, [sorted, searchQuery])

  const updatePosition = useCallback(() => {
    if (useSheet) return
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const gap = 4
    let top = r.bottom + gap
    const spaceBelow = window.innerHeight - r.bottom - gap
    const spaceAbove = r.top - gap
    const w = Math.max(r.width, 200)
    if (spaceBelow < EST_MENU_HEIGHT_PX && spaceAbove > spaceBelow) {
      top = r.top - EST_MENU_HEIGHT_PX - gap
      top = Math.max(gap, top)
    }
    const left = Math.min(Math.max(gap, r.left), window.innerWidth - w - gap)
    setCoords({
      top,
      left,
      width: w,
    })
  }, [useSheet])

  useLayoutEffect(() => {
    if (!open || useSheet) return
    updatePosition()
  }, [open, useSheet, updatePosition])

  useEffect(() => {
    if (!open || useSheet) return
    const btn = triggerRef.current
    if (!btn) return

    updatePosition()
    const scrollParents = getScrollParents(btn)
    scrollParents.forEach((p) => p.addEventListener('scroll', updatePosition, { passive: true }))
    window.addEventListener('resize', updatePosition)

    return () => {
      scrollParents.forEach((p) => p.removeEventListener('scroll', updatePosition))
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, useSheet, updatePosition])

  useEffect(() => {
    if (!open || !useSheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, useSheet])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
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
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), useSheet ? 120 : 60)
      return () => window.clearTimeout(t)
    }
    setSearchQuery('')
  }, [open, useSheet])

  const listContent = (
    <>
      <div className="shrink-0 border-b border-gray-100 p-2 sm:p-2">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded border border-gray-200 py-2 pl-7 pr-2 text-base sm:py-1.5 sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            enterKeyHint="search"
          />
        </div>
      </div>

      <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
        <li>
          <button
            type="button"
            className={`flex w-full items-center px-4 py-3.5 text-left text-base sm:px-3 sm:py-2 sm:text-sm hover:bg-gray-50 active:bg-gray-100 ${
              !value ? 'bg-blue-50 text-blue-800' : 'text-gray-700'
            }`}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            {emptyLabel}
          </button>
        </li>
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-base text-gray-500 sm:px-3 sm:text-sm">No matches</li>
        )}
        {filtered.map((c) => {
          const selectedRow = String(c.id) === value
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`flex w-full items-center px-4 py-3.5 text-left text-base sm:px-3 sm:py-2 sm:text-sm hover:bg-gray-50 active:bg-gray-100 ${
                  selectedRow ? 'bg-blue-50 text-blue-800 font-medium' : 'text-gray-800'
                }`}
                onClick={() => {
                  onChange(String(c.id))
                  setOpen(false)
                }}
              >
                {c.name}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )

  const floatingMenu =
    open &&
    !useSheet &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        className="rounded-md border border-gray-200 bg-white shadow-lg"
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: coords.width,
          zIndex: 10000,
          maxHeight: EST_MENU_HEIGHT_PX,
          display: 'flex',
          flexDirection: 'column',
        }}
        role="presentation"
      >
        {listContent}
      </div>,
      document.body,
    )

  const sheetMenu =
    open &&
    useSheet &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[9998] cursor-default border-0 bg-black/45 p-0"
          aria-label="Close"
          onClick={() => setOpen(false)}
        />
        <div
          ref={menuRef}
          className="fixed bottom-0 left-0 right-0 z-[10000] flex max-h-[min(70vh,420px)] flex-col rounded-t-2xl border border-gray-200 border-b-0 bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
          role="presentation"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <span className="text-base font-semibold text-gray-900">Category</span>
            <button
              type="button"
              className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{listContent}</div>
        </div>
      </>,
      document.body,
    )

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-3 py-2.5 text-left text-base text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 sm:min-h-0 sm:py-2 sm:text-sm"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={`min-w-0 truncate ${selected ? 'text-gray-900' : 'text-gray-500'}`}>
            {selected ? selected.name : emptyLabel}
          </span>
          <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {floatingMenu}
      {sheetMenu}
    </>
  )
}
