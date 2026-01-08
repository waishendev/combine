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
  netTotal: number
  createdAt: string
  updatedAt: string
  refundTotal?: number
  returnSummary?: {
    hasReturn: boolean
    returnCount: number
    returnStatuses: string[]
    returnItemsTotalQty: number
    latestReturnId: number | null
  } | null
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

  const formatReturnStatus = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const hasRefund = order.paymentStatus?.toLowerCase() === 'refunded'
  const refundTotal = order.refundTotal ?? 0
  const returnSummary = order.returnSummary
  const returnStatus = returnSummary?.returnStatuses?.[0]
  const returnStatusLabel = returnStatus ? formatReturnStatus(returnStatus) : ''

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200 font-medium">{order.orderNo}</td>
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex flex-col">
          <span className="font-medium">{order.customerName}</span>
          <span className="text-xs text-gray-500">{order.customerEmail}</span>
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex flex-col gap-2">
          <StatusBadge status={order.status.toLowerCase()} label={order.status} />
          {refundTotal > 0 ? (
            <StatusBadge
              status="refunded"
              label={`Refunded: RM ${formatAmount(refundTotal)}`}
            />
          ) : hasRefund ? (
            <StatusBadge status="refunded" label="Refunded" />
          ) : returnSummary?.hasReturn ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span>
                Return: {returnSummary.returnItemsTotalQty} item(s)
                {returnStatusLabel ? ` • ${returnStatusLabel}` : ''}
              </span>
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">RM {formatAmount(order.netTotal)}</td>
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
