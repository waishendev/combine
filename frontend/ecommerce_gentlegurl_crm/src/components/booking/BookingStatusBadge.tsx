'use client'

import {
  BOOKING_STATUS_BADGE_MAP,
  DEFAULT_BOOKING_STATUS_BADGE_TONE,
} from './bookingStatusBadgeConfig'

type BookingStatusBadgeProps = {
  status: string | null | undefined
  label?: string | null
  className?: string
  showDot?: boolean
}

export default function BookingStatusBadge({
  status,
  label,
  className = '',
  showDot = true,
}: BookingStatusBadgeProps) {
  const key = (status ?? '').toLowerCase()
  const tone = BOOKING_STATUS_BADGE_MAP[key] ?? DEFAULT_BOOKING_STATUS_BADGE_TONE
  const displayText = label ?? (status?.trim() ? status : '-')

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${tone.bgColor} ${tone.textColor} ${className}`}
    >
      {showDot && <span className={`h-2 w-2 rounded-full ${tone.dotColor}`} />}
      {displayText}
    </span>
  )
}

