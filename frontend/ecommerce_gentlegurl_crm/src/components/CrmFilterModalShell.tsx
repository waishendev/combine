'use client'

import { ReactNode } from 'react'

type CrmFilterModalShellProps = {
  title: ReactNode
  onClose: () => void
  closeLabel?: string
  children: ReactNode
  footer: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function CrmFilterModalShell({
  title,
  onClose,
  closeLabel = 'Close',
  children,
  footer,
  size = 'md',
}: CrmFilterModalShellProps) {
  const sizeClass =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative mx-auto flex w-full ${sizeClass} max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden rounded-lg bg-white shadow-lg`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={closeLabel}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        <div className="flex shrink-0 items-center justify-between border-t border-gray-300 px-5 py-3">
          {footer}
        </div>
      </div>
    </div>
  )
}
