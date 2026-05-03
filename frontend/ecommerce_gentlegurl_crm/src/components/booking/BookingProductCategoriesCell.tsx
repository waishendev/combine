'use client'

import { useEffect, useState } from 'react'

import type { BookingProductRowData } from './bookingProductTypes'
import { useI18n } from '@/lib/i18n'

type Props = {
  product: BookingProductRowData
  canView?: boolean
  onView?: (product: BookingProductRowData) => void
}

export default function BookingProductCategoriesCell({ product, canView = false, onView }: Props) {
  const { t } = useI18n()
  const [visibleNameCount, setVisibleNameCount] = useState(2)

  useEffect(() => {
    const calculateVisibleCount = () => {
      if (typeof window === 'undefined') return 2
      const width = window.innerWidth

      if (width >= 1536) return 5
      if (width >= 1280) return 3
      if (width >= 1024) return 3
      if (width >= 768) return 3
      return 2
    }

    const updateVisibleCount = () => {
      setVisibleNameCount((prev) => {
        const next = calculateVisibleCount()
        return prev === next ? prev : next
      })
    }

    updateVisibleCount()

    window.addEventListener('resize', updateVisibleCount)
    return () => window.removeEventListener('resize', updateVisibleCount)
  }, [])

  const names = (product.categories ?? []).map((c) => c.name).filter(Boolean)
  const catCount = names.length

  const previewNames = names.slice(0, visibleNameCount)
  const remaining = catCount - previewNames.length
  const displayText =
    catCount === 0
      ? '—'
      : previewNames.length > 0
        ? `${previewNames.join(', ')}${remaining > 0 ? ` +${remaining} ${t('role.moreSuffix')}` : ''}`
        : `${catCount} categories`

  return (
    <div className="flex items-center gap-2">
      <span
        className={`max-w-[220px] break-words sm:max-w-[320px] lg:max-w-[480px] xl:max-w-[640px] 2xl:max-w-[800px] ${
          catCount === 0 ? 'text-gray-400' : 'text-gray-700'
        }`}
      >
        {displayText}
      </span>
      {canView && catCount > 0 && (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600"
          onClick={() => onView?.(product)}
          aria-label={t('booking.viewProductCategories')}
          title={t('booking.viewProductCategories')}
        >
          <i className="fa-solid fa-eye" />
        </button>
      )}
    </div>
  )
}
