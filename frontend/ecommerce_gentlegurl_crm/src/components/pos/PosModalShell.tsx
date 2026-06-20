'use client'

import { ReactNode } from 'react'

type PosModalShellProps = {
  onClose: () => void
  closeDisabled?: boolean
  zIndexClassName?: string
  overlayClassName?: string
  panelClassName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  rounded?: 'lg' | '2xl'
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

const sizeClasses: Record<NonNullable<PosModalShellProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
}

export default function PosModalShell({
  onClose,
  closeDisabled = false,
  zIndexClassName = 'z-50',
  overlayClassName = 'bg-black/50 backdrop-blur-sm',
  panelClassName = '',
  size = 'lg',
  rounded = '2xl',
  header,
  footer,
  children,
}: PosModalShellProps) {
  const roundedClass = rounded === '2xl' ? 'rounded-2xl' : 'rounded-lg'

  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center overflow-y-auto p-4 ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close modal"
        disabled={closeDisabled}
        onClick={() => {
          if (!closeDisabled) onClose()
        }}
      />
      <div
        className={`relative mx-auto flex w-full ${sizeClasses[size]} max-h-[min(90dvh,calc(100vh-2rem))] flex-col overflow-hidden ${roundedClass} bg-white shadow-2xl ${panelClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {header ? <div className="shrink-0">{header}</div> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </div>
  )
}
