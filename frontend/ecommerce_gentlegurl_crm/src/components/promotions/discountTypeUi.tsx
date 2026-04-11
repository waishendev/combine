'use client'

import { useI18n } from '@/lib/i18n'

const discountClass: Record<string, string> = {
  bundle_fixed_price:
    'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-600/15',
  percentage_discount:
    'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-600/15',
  fixed_discount:
    'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/15',
}

const triggerClass: Record<string, string> = {
  quantity:
    'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-600/15',
  amount:
    'bg-indigo-100 text-indigo-800 ring-1 ring-inset ring-indigo-600/15',
}

function humanizeKey(raw: string) {
  return raw.replace(/_/g, ' ')
}

/** Plain text label (no badge) — use in tables and read-only lines. */
export function DiscountTypeText({
  type,
  className = 'text-sm text-gray-800',
}: {
  type: string
  className?: string
}) {
  const { t } = useI18n()
  if (!type) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const key = `promotions.discountType.${type}`
  const translated = t(key)
  const label = translated !== key ? translated : humanizeKey(type)
  return <span className={className}>{label}</span>
}

export function TriggerTypeText({
  type,
  className = 'text-sm text-gray-800',
}: {
  type: string
  className?: string
}) {
  const { t } = useI18n()
  if (!type) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const key = `promotions.trigger.${type}`
  const translated = t(key)
  const label = translated !== key ? translated : humanizeKey(type)
  return <span className={className}>{label}</span>
}

export function DiscountTypeBadge({ type }: { type: string }) {
  const { t } = useI18n()
  if (!type) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const key = `promotions.discountType.${type}`
  const translated = t(key)
  const label = translated !== key ? translated : humanizeKey(type)
  const cls =
    discountClass[type] ??
    'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/15'

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      title={type}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}

export function TriggerTypeBadge({ type }: { type: string }) {
  const { t } = useI18n()
  if (!type) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const key = `promotions.trigger.${type}`
  const translated = t(key)
  const label = translated !== key ? translated : humanizeKey(type)
  const cls =
    triggerClass[type] ??
    'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-500/15'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      title={type}
    >
      {label}
    </span>
  )
}
