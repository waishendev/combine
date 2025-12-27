'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface OrderRowData {
  id: number
  orderNo: string
  customerName: string
  customerEmail: string
  status: string
  paymentStatus: string
  orderStatus: string
  grandTotal: number
  createdAt: string
  updatedAt: string
}

interface OrderRowProps {
  order: OrderRowData
  showActions?: boolean
  canView?: boolean
  onView?: (order: OrderRowData) => void
}

export default function OrderRow({
  order,
  showActions = false,
  canView = false,
  onView,
}: OrderRowProps) {
  const { t } = useI18n()

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }


  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200 font-medium">{order.orderNo}</td>
      <td className="px-4 py-2 border border-gray-200">{order.customerName}</td>
      <td className="px-4 py-2 border border-gray-200">{order.customerEmail}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge status={order.status.toLowerCase()} label={order.status} />
      </td>
      <td className="px-4 py-2 border border-gray-200">RM {formatAmount(order.grandTotal)}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDate(order.createdAt)}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canView && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => onView?.(order)}
                aria-label="View Order"
                title="View Order"
              >
                <i className="fa-solid fa-eye" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

