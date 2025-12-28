'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface CustomerRowData {
  id: number
  name: string
  email: string
  phone: string
  tier: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CustomerRowProps {
  customer: CustomerRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canView?: boolean
  onEdit?: (customer: CustomerRowData) => void
  onDelete?: (customer: CustomerRowData) => void
  onView?: (customer: CustomerRowData) => void
}

export default function CustomerRow({
  customer,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canView = false,
  onEdit,
  onDelete,
  onView,
}: CustomerRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{customer.name}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.email}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.phone}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.tier}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={customer.isActive ? 'active' : 'inactive'}
          label={customer.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">{customer.createdAt}</td>
      {(showActions || canView) && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canView && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => onView?.(customer)}
                aria-label={t('customer.viewAction')}
                title={t('customer.viewAction')}
              >
                <i className="fa-solid fa-eye" />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(customer)}
                aria-label={t('customer.editAction')}
                title={t('customer.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(customer)}
                aria-label={t('customer.deleteAction')}
                title={t('customer.deleteAction')}
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

