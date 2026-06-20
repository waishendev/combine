'use client'

export function PosCatalogInCartBadge({ qty, className = '' }: { qty: number; className?: string }) {
  if (qty <= 0) return null

  return (
    <div
      className={`absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
      aria-label={`${qty} in cart`}
    >
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      <span>{qty}</span>
    </div>
  )
}

export function posCatalogInCartBorderClass(
  isInCart: boolean,
  options?: { highlighted?: boolean },
): string {
  if (options?.highlighted) {
    return 'border-blue-500 bg-white shadow-lg ring-2 ring-blue-500/20'
  }
  if (isInCart) {
    return 'border-emerald-500 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/25'
  }
  return ''
}
