'use client'

import type { ReactNode } from 'react'

type ReportViewDetailsButtonProps = {
  onClick: () => void
  disabled?: boolean
  title?: string
  className?: string
  label?: string
}

export function ReportViewDetailsButton({
  onClick,
  disabled = false,
  title = 'View details',
  className = '',
  label,
}: ReportViewDetailsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <i className="fa-solid fa-eye text-xs" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </button>
  )
}

type ReportDetailDrawerProps = {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  loading?: boolean
  loadingText?: string
  error?: ReactNode
  empty?: ReactNode
  footer?: ReactNode
  maxWidthClassName?: string
  zIndexClassName?: string
}

export function ReportDetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  loading = false,
  loadingText = 'Loading details…',
  error,
  empty,
  footer,
  maxWidthClassName = 'max-w-5xl',
  zIndexClassName = 'z-50',
}: ReportDetailDrawerProps) {
  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex justify-end bg-slate-950/50`} role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close details" onClick={onClose} />
      <div className={`relative flex h-full w-full ${maxWidthClassName} flex-col overflow-hidden bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Details</p>
            <h3 className="mt-1 truncate text-xl font-bold text-slate-900">{title}</h3>
            {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label="Close details"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500">{loadingText}</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : empty ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">{empty}</div>
          ) : (
            children
          )}
        </div>

        {footer ? <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}
