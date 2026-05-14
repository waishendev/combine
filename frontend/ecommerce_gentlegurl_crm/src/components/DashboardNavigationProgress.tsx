'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

function sameDestinationAsCurrent(url: URL): boolean {
  const dest = `${url.pathname}${url.search}`
  const cur = `${window.location.pathname}${window.location.search}`
  return dest === cur
}

/**
 * Refined indeterminate bar under the fixed header during in-app navigations.
 */
export default function DashboardNavigationProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setActive(false)
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (!active) return
    const id = window.setTimeout(() => setActive(false), 12_000)
    return () => window.clearTimeout(id)
  }, [active])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor?.href) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return

      let url: URL
      try {
        url = new URL(anchor.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      if (sameDestinationAsCurrent(url)) return

      setActive(true)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  if (!active) return null

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-16 z-[55] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      {/* Track: soft inset + hairline top highlight */}
      <div className="relative h-[3px] bg-gradient-to-b from-slate-200/95 via-slate-100 to-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent opacity-90"
          aria-hidden
        />
        {/* Moving gradient ribbon */}
        <div
          className="absolute top-1/2 h-[2px] w-[min(42%,22rem)] -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-600 shadow-[0_0_14px_rgba(99,102,241,0.55),0_0_28px_rgba(139,92,246,0.25)] animate-crm-nav-glide"
          aria-hidden
        />
      </div>
    </div>
  )
}
