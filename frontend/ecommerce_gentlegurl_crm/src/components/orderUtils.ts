import type { OrderRowData } from './OrderRow'

export type OrderApiItem = {
  id: number | string
  order_no?: string | null
  order_number?: string | null
  customer?: {
    id?: number | string
    name?: string | null
    email?: string | null
  } | null
  status?: string | null
  payment_status?: string | null
  refund_total?: string | number | null
  return_summary?: {
    has_return?: boolean
    return_count?: number
    return_statuses?: string[]
    return_items_total_qty?: number
    latest_return_id?: number | null
  } | null
  subtotal?: string | number | null
  discount_total?: string | number | null
  shipping_fee?: string | number | null
  grand_total?: string | number | null
  shipping_method?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapOrderApiItemToRow = (item: OrderApiItem): OrderRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const orderNo = item.order_no ?? item.order_number ?? '-'
  const customerName = item.customer?.name ?? '-'
  const customerEmail = item.customer?.email ?? '-'

  // Calculate status based on payment_status and status
  const status = calculateOrderStatus(item.status, item.payment_status)

  const grandTotal = item.grand_total
    ? typeof item.grand_total === 'string'
      ? Number.parseFloat(item.grand_total)
      : Number(item.grand_total)
    : 0

  const returnSummary = item.return_summary
    ? {
        hasReturn: Boolean(item.return_summary.has_return),
        returnCount: Number(item.return_summary.return_count ?? 0),
        returnStatuses: item.return_summary.return_statuses ?? [],
        returnItemsTotalQty: Number(item.return_summary.return_items_total_qty ?? 0),
        latestReturnId: item.return_summary.latest_return_id ?? null,
      }
    : null

  return {
    id: normalizedId,
    orderNo: String(orderNo),
    customerName,
    customerEmail,
    status,
    paymentStatus: item.payment_status ?? '',
    orderStatus: item.status ?? '',
    grandTotal,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
    returnSummary,
    refundTotal: item.refund_total
      ? typeof item.refund_total === 'string'
        ? Number.parseFloat(item.refund_total)
        : Number(item.refund_total)
      : 0,
  }
}

// Convert OrderDetailData to OrderApiItem for table update
export function convertOrderDetailToApiItem(orderDetail: {
  id: number
  order_no?: string
  order_number?: string
  status?: string
  payment_status?: string
  grand_total?: string | number
  shipping_method?: string
  created_at?: string
  updated_at?: string
  refund_total?: string | number
  customer?: {
    id?: number
    name?: string
    email?: string
  }
}): OrderApiItem {
  return {
    id: orderDetail.id,
    order_no: orderDetail.order_no ?? orderDetail.order_number ?? null,
    order_number: orderDetail.order_number ?? orderDetail.order_no ?? null,
    status: orderDetail.status ?? null,
    payment_status: orderDetail.payment_status ?? null,
    grand_total: orderDetail.grand_total ?? null,
    shipping_method: orderDetail.shipping_method ?? null,
    created_at: orderDetail.created_at ?? null,
    updated_at: orderDetail.updated_at ?? null,
    refund_total: orderDetail.refund_total ?? null,
    customer: orderDetail.customer
      ? {
          id: orderDetail.customer.id ?? undefined,
          name: orderDetail.customer.name ?? null,
          email: orderDetail.customer.email ?? null,
        }
      : null,
  }
}

export function calculateOrderStatus(
  orderStatus: string | null | undefined,
  paymentStatus: string | null | undefined
): string {
  const status = orderStatus?.toLowerCase() ?? ''
  const payment = paymentStatus?.toLowerCase() ?? ''

  // Awaiting Payment
  if (payment === 'unpaid' && status === 'pending') {
    return 'Awaiting Payment'
  }

  // Waiting for Verification
  if (payment === 'unpaid' && status === 'processing') {
    return 'Waiting for Verification'
  }

  // Payment Proof Rejected
  if (status === 'reject_payment_proof' && payment === 'unpaid') {
    return 'Payment Proof Rejected'
  }

  // Payment Failed
  if (payment === 'failed') {
    return 'Payment Failed'
  }

  // Refunded (must check before Cancelled)
  if (status === 'cancelled' && payment === 'refunded') {
    return 'Refunded'
  }

  // Cancelled
  if (status === 'cancelled') {
    return 'Cancelled'
  }

  // Payment Confirmed
  if (status === 'confirmed' && payment === 'paid') {
    return 'Payment Confirmed'
  }

  // Preparing
  if (status === 'processing' && payment === 'paid') {
    return 'Preparing'
  }

  // Ready for Pickup
  if (status === 'ready_for_pickup' && payment === 'paid') {
    return 'Ready for Pickup'
  }

  // Shipped
  if (status === 'shipped') {
    return 'Shipped'
  }

  // Completed
  if (status === 'completed') {
    return 'Completed'
  }

  // Default fallback
  return status || payment || 'Unknown'
}

// Convert display status back to API filter parameters
export function mapDisplayStatusToApiFilters(displayStatus: string): {
  status?: string
  payment_status?: string
} {
  switch (displayStatus) {
    case 'Awaiting Payment':
      return {
        status: 'pending',
        payment_status: 'unpaid',
      }
    case 'Waiting for Verification':
      return {
        status: 'processing',
        payment_status: 'unpaid',
      }
    case 'Payment Proof Rejected':
      return {
        status: 'reject_payment_proof',
        payment_status: 'unpaid',
      }
    case 'Payment Failed':
      return {
        payment_status: 'failed',
      }
    case 'Cancelled':
      return {
        status: 'cancelled',
      }
    case 'Refunded':
      return {
        status: 'cancelled',
        payment_status: 'refunded',
      }
    case 'Payment Confirmed':
      return {
        status: 'confirmed',
        payment_status: 'paid',
      }
    case 'Preparing':
      return {
        status: 'processing',
        payment_status: 'paid',
      }
    case 'Ready for Pickup':
      return {
        status: 'ready_for_pickup',
        payment_status: 'paid',
      }
    case 'Shipped':
      return {
        status: 'shipped',
      }
    case 'Completed':
      return {
        status: 'completed',
      }
    default:
      return {}
  }
}
