'use client'

import StatusBadge from '../StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface BookingServiceRowData {
  id: number
  name: string
  description: string
  duration_min: number
  service_price: string | number
  deposit_amount: string | number
  buffer_min: number
  isActive: boolean
  imagePath?: string
  imageUrl?: string
  createdAt?: string
}

interface BookingServiceRowProps {
  service: BookingServiceRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (service: BookingServiceRowData) => void
  onDelete?: (service: BookingServiceRowData) => void
}

export default function BookingServiceRow({
  service,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: BookingServiceRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-gray-200" />}</td>
      <td className="px-4 py-2 border border-gray-200">{service.name}</td>
      <td className="px-4 py-2 border border-gray-200">{service.description || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{service.duration_min}</td>
      <td className="px-4 py-2 border border-gray-200">{service.service_price}</td>
      <td className="px-4 py-2 border border-gray-200">{service.deposit_amount}</td>
      <td className="px-4 py-2 border border-gray-200">{service.buffer_min}</td>
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
