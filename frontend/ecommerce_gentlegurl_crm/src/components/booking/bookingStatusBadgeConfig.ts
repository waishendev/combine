export type BookingStatusTone = {
  textColor: string
  bgColor: string
  dotColor: string
}

export const BOOKING_STATUS_BADGE_MAP: Record<string, BookingStatusTone> = {
  confirmed: {
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-100',
    dotColor: 'bg-blue-500',
  },
  completed: {
    textColor: 'text-green-700',
    bgColor: 'bg-green-100',
    dotColor: 'bg-green-500',
  },
  /** POS appointments: COMPLETED + register paid (same idea as “Paid” badge). */
  completed_paid: {
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-100',
    dotColor: 'bg-emerald-600',
  },
  /** POS appointments: COMPLETED but still owes / package reserved, not finalised. */
  completed_unpaid: {
    textColor: 'text-amber-900',
    bgColor: 'bg-amber-100',
    dotColor: 'bg-amber-500',
  },
  cancelled: {
    textColor: 'text-red-700',
    bgColor: 'bg-red-100',
    dotColor: 'bg-red-500',
  },
  late_cancellation: {
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-100',
    dotColor: 'bg-orange-500',
  },
  no_show: {
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
    dotColor: 'bg-slate-500',
  },
  notified_cancellation: {
    textColor: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    dotColor: 'bg-indigo-500',
  },
  hold: {
    textColor: 'text-violet-800',
    bgColor: 'bg-violet-100',
    dotColor: 'bg-violet-500',
  },
  expired: {
    textColor: 'text-rose-700',
    bgColor: 'bg-rose-100',
    dotColor: 'bg-rose-500',
  },
}

export const DEFAULT_BOOKING_STATUS_BADGE_TONE: BookingStatusTone = {
  textColor: 'text-gray-600',
  bgColor: 'bg-gray-100',
  dotColor: 'bg-gray-400',
}

