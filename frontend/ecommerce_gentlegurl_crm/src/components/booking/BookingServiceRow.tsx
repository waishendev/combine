'use client'

import { useEffect, useState } from 'react'

import StatusBadge from '../StatusBadge'
import { formatBookingServicePriceLabel } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'

export interface BookingServiceRowData {
  id: number
  name: string
  serviceType?: string
  description: string
  duration_min: number
  service_price: string | number
  price_mode?: 'fixed' | 'range'
  range_min?: number
  range_max?: number
  deposit_amount: string | number
  buffer_min: number
  isActive: boolean
  imagePath?: string
  imageUrl?: string
  createdAt?: string
  allowedStaffCount?: number
  allowedStaffNames?: string[]
  primarySlots?: string[]
}

interface BookingServiceRowProps {
  service: BookingServiceRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canViewAllowedStaff?: boolean
  onEdit?: (service: BookingServiceRowData) => void
  onDelete?: (service: BookingServiceRowData) => void
  onViewAllowedStaff?: (service: BookingServiceRowData) => void
}

export default function BookingServiceRow({
  service,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canViewAllowedStaff = false,
  onEdit,
  onDelete,
  onViewAllowedStaff,
}: BookingServiceRowProps) {
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

  const names = service.allowedStaffNames ?? []
  const staffCount =
    service.allowedStaffCount != null && service.allowedStaffCount > 0
      ? service.allowedStaffCount
      : names.length

  const previewNames = names.slice(0, visibleNameCount)
  const remaining = staffCount - previewNames.length
  const displayText =
    staffCount === 0
      ? '—'
      : previewNames.length > 0
        ? `${previewNames.join(', ')}${remaining > 0 ? ` +${remaining} ${t('role.moreSuffix')}` : ''}`
        : `${staffCount} staff`

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-gray-200" />}</td>
      <td className="px-4 py-2 border border-gray-200">{service.name}</td>
      <td className="px-4 py-2 border border-gray-200">{service.serviceType || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{service.description || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{service.duration_min}</td>
      <td className="px-4 py-2 border border-gray-200">
        {formatBookingServicePriceLabel(service)}
      </td>
      <td className="px-4 py-2 border border-gray-200">{service.deposit_amount}</td>
      <td className="px-4 py-2 border border-gray-200">{service.buffer_min}</td>
      <td className="border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`max-w-[220px] break-words sm:max-w-[320px] lg:max-w-[480px] xl:max-w-[640px] 2xl:max-w-[800px] ${
              staffCount === 0 ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            {displayText}
          </span>
          {canViewAllowedStaff && staffCount > 0 && (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => onViewAllowedStaff?.(service)}
              aria-label={t('booking.viewAllowedStaff')}
              title={t('booking.viewAllowedStaff')}
            >
              <i className="fa-solid fa-eye" />
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={service.isActive ? 'active' : 'inactive'}
          label={service.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(service)}
                aria-label={t('common.edit')}
                title={t('common.edit')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(service)}
                aria-label={t('common.delete')}
                title={t('common.delete')}
              >
                <i className="fa-solid fa-trash" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
