'use client'

import { ReactNode } from 'react'

type CrmFormModalShellProps = {
  title: ReactNode
  onClose: () => void
  closeDisabled?: boolean
  closeLabel?: string
  size?: 'sm' | 'lg' | 'xl'
  rootClassName?: string
  children: ReactNode
  footer?: ReactNode
}

export default function CrmFormModalShell({
  title,
  onClose,
  closeDisabled = false,
  closeLabel = 'Close',
  size = 'sm',
  rootClassName,
  children,
  footer,
}: CrmFormModalShellProps) {
  const sizeClass =
    size === 'xl' ? 'sm:max-w-6xl' : size === 'lg' ? 'sm:max-w-4xl' : 'sm:max-w-lg'

  return (
    <div className={rootClassName ?? 'fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:overflow-y-auto sm:p-4'}>
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!closeDisabled) onClose()
        }}
      />
      <div
        className={`relative flex max-h-[min(92dvh,100vh)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:mx-auto sm:max-h-[min(90dvh,calc(100vh-2rem))] sm:rounded-lg sm:shadow-lg ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 className="pr-3 text-base font-semibold leading-snug sm:text-lg">{title}</h2>
          <button
            onClick={() => {
              if (!closeDisabled) onClose()
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-gray-500 hover:bg-slate-100 hover:text-gray-700"
            aria-label={closeLabel}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-300 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-5 sm:py-4 [&_button]:min-h-[44px] sm:[&_button]:min-h-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
