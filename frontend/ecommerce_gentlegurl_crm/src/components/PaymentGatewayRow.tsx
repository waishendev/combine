'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface PaymentGatewayRowData {
  id: number
  key: string
  name: string
  isActive: boolean
  isDefault: boolean
  sort_order: number | null
  createdAt: string
  updatedAt: string
}

interface PaymentGatewayRowProps {
  paymentGateway: PaymentGatewayRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canMove?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (paymentGateway: PaymentGatewayRowData) => void
  onDelete?: (paymentGateway: PaymentGatewayRowData) => void
  onMoveUp?: (paymentGateway: PaymentGatewayRowData) => void
  onMoveDown?: (paymentGateway: PaymentGatewayRowData) => void
}

export default function PaymentGatewayRow({
  paymentGateway,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canMove = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PaymentGatewayRowProps) {
  const { t } = useI18n()

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{paymentGateway.key}</td>
      <td className="px-4 py-2 border border-gray-200">{paymentGateway.name}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={paymentGateway.isActive ? 'active' : 'inactive'}
          label={paymentGateway.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {paymentGateway.isDefault ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Default
          </span>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {canMove ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(paymentGateway)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center min-w-[2rem]">
              {paymentGateway.sort_order != null ? paymentGateway.sort_order : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(paymentGateway)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{paymentGateway.sort_order != null ? paymentGateway.sort_order : '-'}</span>
        )}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(paymentGateway)}
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
                onClick={() => onDelete?.(paymentGateway)}
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

