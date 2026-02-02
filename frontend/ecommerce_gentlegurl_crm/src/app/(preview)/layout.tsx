'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'

import './preview.css'

export default function PreviewLayout({ children }: { children: ReactNode }) {
  const colorMode = process.env.NEXT_PUBLIC_COLOR ?? '2'
  const theme = colorMode === '2' ? 'cream' : 'soft'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
      document.body.setAttribute('data-theme', theme)
    }
  }, [theme])

  return (
    <div className="preview-root min-h-screen overflow-y-auto bg-[var(--background-soft)] text-[var(--foreground)]">
      {children}
    </div>
  )
}
