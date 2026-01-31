import type { ReactNode } from 'react'

import './preview.css'

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="soft"
      className="min-h-screen overflow-y-auto bg-[var(--background-soft)] text-[var(--foreground)]"
    >
      {children}
    </div>
  )
}
