'use client'

import { useEffect, useState } from 'react'

/** Matches globals.css two-column POS / appointments layout. */
export const POS_WIDE_LAYOUT_MQ =
  '(min-width: 1024px) and (min-height: 640px), (orientation: landscape) and (min-width: 768px) and (min-height: 500px)'

export function usePosWideLayout() {
  const [isWideLayout, setIsWideLayout] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(POS_WIDE_LAYOUT_MQ)
    const sync = () => setIsWideLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return {
    /** null = not yet measured on client */
    isWideLayout,
    isCompactLayout: isWideLayout === null ? null : !isWideLayout,
  }
}
