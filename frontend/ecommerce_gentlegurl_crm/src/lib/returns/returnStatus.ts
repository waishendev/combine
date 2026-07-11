export const ACTIVE_RETURN_STATUSES = ['requested', 'approved', 'in_transit', 'received'] as const

export const TERMINAL_RETURN_STATUSES = new Set(['refunded', 'rejected', 'cancelled'])

export const normalizeReturnStatus = (status?: string | null): string => {
  if (!status) return ''
  return status.toLowerCase().replace(/\s+/g, '_')
}

export const isActiveReturnStatus = (status?: string | null): boolean =>
  ACTIVE_RETURN_STATUSES.includes(
    normalizeReturnStatus(status) as (typeof ACTIVE_RETURN_STATUSES)[number],
  )

export const formatReturnStatusLabel = (status?: string | null) => {
  if (!status) return 'Unknown'
  const normalized = normalizeReturnStatus(status).replace(/_/g, ' ')
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getReturnStatusBadgeClasses = (status?: string | null) => {
  const base = 'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide'
  switch (normalizeReturnStatus(status)) {
    case 'requested':
      return `${base} border-amber-200 bg-amber-100 text-amber-800`
    case 'approved':
      return `${base} border-sky-200 bg-sky-100 text-sky-800`
    case 'in_transit':
      return `${base} border-violet-200 bg-violet-100 text-violet-800`
    case 'received':
      return `${base} border-cyan-200 bg-cyan-100 text-cyan-800`
    case 'refunded':
      return `${base} border-green-200 bg-green-100 text-green-800`
    case 'rejected':
      return `${base} border-rose-200 bg-rose-100 text-rose-800`
    case 'cancelled':
      return `${base} border-gray-300 bg-gray-100 text-gray-700`
    default:
      return `${base} border-slate-200 bg-slate-100 text-slate-700`
  }
}

/** Compact badge for POS Request Center (ring style, matches ecommerce order badges). */
export const getReturnStatusPosBadgeClasses = (status?: string | null): string => {
  switch (normalizeReturnStatus(status)) {
    case 'requested':
      return 'bg-amber-100 text-amber-900 ring-amber-200'
    case 'approved':
      return 'bg-sky-100 text-sky-900 ring-sky-200'
    case 'in_transit':
      return 'bg-violet-100 text-violet-900 ring-violet-200'
    case 'received':
      return 'bg-cyan-100 text-cyan-900 ring-cyan-200'
    default:
      return 'bg-slate-100 text-slate-800 ring-slate-200'
  }
}
