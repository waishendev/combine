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

import type { BookingServiceOption } from './servicePackageTypes'

type Props = {
  options: BookingServiceOption[]
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** Empty trigger label (default: Select service) */
  placeholder?: string
  searchPlaceholder?: string
  /** e.g. "Service" → unknown row shows "Service #12" */
  unknownEntityLabel?: string
  /** Bottom sheet title on mobile (defaults to unknownEntityLabel) */
  sheetTitle?: string
  ariaLabel?: string
  emptySearchMessage?: string
  emptyListMessage?: string
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

const EST_MENU_HEIGHT_PX = 320
const MOBILE_SHEET_MQ = '(max-width: 639px)'

function useMobilePickerSheet(): boolean {
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

export default function BookingPackageItemServicePicker({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select service',
  searchPlaceholder = 'Search services…',
  unknownEntityLabel = 'Service',
  sheetTitle,
  ariaLabel = 'Select service',
  emptySearchMessage = 'No services match your search.',
  emptyListMessage = 'No services found.',
}: Props) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const useSheet = useMobilePickerSheet()
  const resolvedSheetTitle = sheetTitle ?? unknownEntityLabel

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
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
      const cnName = (s.cn_name ?? '').toLowerCase()
      const id = String(s.id)
      return name.includes(q) || cnName.includes(q) || id.includes(q)
    })
  }, [options, searchQuery])

  const closePicker = useCallback(() => {
    setOpen(false)
    setSearchQuery('')
  }, [])

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
    setCoords({ top, left, width: w })
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
      closePicker()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, closePicker])

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => searchRef.current?.focus(), useSheet ? 120 : 60)
      return () => clearTimeout(t)
    }
    setSearchQuery('')
  }, [open, useSheet])

  const triggerText = selected
    ? selected.name
    : value
      ? `${unknownEntityLabel} #${value}`
      : placeholder

  const listContent = (
    <>
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 p-2.5">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-9 text-base sm:text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            enterKeyHint="search"
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5" role="listbox">
        {filtered.length === 0 ? (
          <div className="p-5 text-center text-sm text-gray-500">
            {searchQuery ? emptySearchMessage : emptyListMessage}
          </div>
        ) : (
          filtered.map((service) => {
            const isSelected = String(service.id) === value
            return (
              <button
                key={service.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(String(service.id))
                  closePicker()
                }}
                className={`flex w-full items-start gap-2 rounded-md px-3 py-3 text-left text-base transition sm:py-2 sm:text-sm ${
                  isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-tight">{service.name}</span>
                  {service.cn_name ? (
                    <span className="mt-0.5 block text-xs leading-tight text-gray-500">{service.cn_name}</span>
                  ) : null}
                </span>
                {isSelected && <i className="fa-solid fa-check-circle mt-0.5 shrink-0 text-xs text-blue-600" />}
              </button>
            )
          })
        )}
      </div>
    </>
  )

  const floatingMenu =
    open &&
    !useSheet &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
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
          onClick={closePicker}
        />
        <div
          ref={menuRef}
          className="fixed bottom-0 left-0 right-0 z-[10000] flex max-h-[min(70vh,420px)] flex-col rounded-t-2xl border border-gray-200 border-b-0 bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]"
          role="presentation"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <span className="text-base font-semibold text-gray-900">{resolvedSheetTitle}</span>
            <button
              type="button"
              className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Close"
              onClick={closePicker}
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
    <div className="min-w-0">
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            if (disabled) return
            setOpen((o) => !o)
          }}
          className="flex min-h-[44px] w-full min-w-0 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2.5 text-left text-base hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-2 sm:text-sm"
        >
          <span className={`min-w-0 flex-1 ${selected || value ? 'text-gray-900' : 'text-gray-500'}`}>
            <span className="block truncate">{triggerText}</span>
            {selected?.cn_name ? (
              <span className="mt-0.5 block truncate text-xs text-gray-500">{selected.cn_name}</span>
            ) : null}
          </span>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ml-2 shrink-0 text-xs text-gray-400`} />
        </button>
      </div>
      {floatingMenu}
      {sheetMenu}
    </div>
  )
}
