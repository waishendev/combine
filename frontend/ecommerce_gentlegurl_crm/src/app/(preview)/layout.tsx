import type { ReactNode } from 'react'

import './preview.css'

export default function PreviewLayout({ children }: { children: ReactNode }) {
  const colorMode = process.env.NEXT_PUBLIC_COLOR ?? '2'
  const theme = colorMode === '2' ? 'cream' : 'soft'

  return (
    <div
      data-theme={theme}
      className="preview-root min-h-screen overflow-y-auto bg-[var(--background-soft)] text-[var(--foreground)]"
    >
      {children}
    </div>
  )
}
