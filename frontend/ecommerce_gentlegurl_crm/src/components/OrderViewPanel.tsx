'use client'

import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'
import { calculateOrderStatus } from './orderUtils'
import OrderConfirmPaymentModal from './OrderConfirmPaymentModal'
import OrderRejectPaymentModal from './OrderRejectPaymentModal'
import OrderCancelModal from './OrderCancelModal'
import OrderShipModal from './OrderShipModal'
import OrderRefundModal from './OrderRefundModal'

interface OrderViewPanelProps {
  orderId: number
  onClose: () => void
  onOrderUpdated?: (updatedOrder?: OrderDetailData) => void
}

type OrderDetailData = {
  id: number
  order_no: string
  order_number?: string
  status: string
  payment_status: string
  subtotal: string
  discount_total: string
  shipping_fee: string
  grand_total: string
  shipping_method: string
  shipping_courier?: string | null
  shipping_tracking_no?: string | null
  shipped_at?: string | null
  notes?: string | null
  pickup_or_shipping?: string
  address?: {
    shipping_name?: string
    shipping_phone?: string
    shipping_address_line1?: string
    shipping_address_line2?: string
    shipping_city?: string
    shipping_state?: string
    shipping_postcode?: string
    shipping_country?: string
  }
  customer?: {
    id: number
    name: string
    email: string
    phone?: string
    tier?: string
  }
  items?: Array<{
    product_id: number
    product_name: string
    quantity: number
    unit_price?: string | null
    line_total: string
    product_image?: string | null
  }>
  vouchers?: Array<{
    code: string
    discount_amount: string
  }>
  payment_info?: {
    payment_status: string
    paid_at?: string | null
    payment_method: string
  }
  uploads?: Array<{
    id: number
    path: string
    url?: string
  }>
  admin_note?: string | null
  refund_proof_path?: string | null
  refunded_at?: string | null
}

export default function OrderViewPanel({
  orderId,
  onClose,
  onOrderUpdated,
}: OrderViewPanelProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderDetailData | null>(null)
  const [showConfirmPayment, setShowConfirmPayment] = useState(false)
  const [showRejectPayment, setShowRejectPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showShip, setShowShip] = useState(false)
  const [showRefund, setShowRefund] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadOrder = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
        })

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError('Failed to load order')
          return
        }

        const orderData = data?.data as OrderDetailData | undefined
        if (!orderData || typeof orderData !== 'object') {
          setError('Failed to load order')
          return
        }

        setOrder(orderData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load order')
        }
      } finally {
        setLoading(false)
      }
    }

    loadOrder().catch(() => {
      setLoading(false)
      setError('Failed to load order')
    })

    return () => controller.abort()
  }, [orderId])

  const handleOrderUpdated = async () => {
    // Reload order data
    const controller = new AbortController()
    try {
      const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      })

      const data = await res.json().catch(() => null)
      if (data?.data) {
        const updatedOrder = data.data as OrderDetailData
        setOrder(updatedOrder)
        // Pass updated order data to parent for table update
        onOrderUpdated?.(updatedOrder)
      }
    } catch (err) {
      console.error('Failed to reload order:', err)
      onOrderUpdated?.()
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const formatAmount = (amount: string | number | null | undefined) => {
    if (!amount) return '0.00'
    const num = typeof amount === 'string' ? Number.parseFloat(amount) : Number(amount)
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return null
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    // Get base URL from environment (NEXT_PUBLIC_ vars are available in client components)
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
    
    // If it starts with /, it's already a path
    if (imagePath.startsWith('/')) {
      return `${baseUrl}${imagePath}`
    }
    // Otherwise, prepend /storage/
    return `${baseUrl}/storage/${imagePath}`
  }

  const ProductImage = ({
    imagePath,
    alt,
  }: {
    imagePath?: string | null
    alt: string
  }) => {
    const [hasError, setHasError] = useState(false)
    const resolvedUrl = getImageUrl(imagePath)
    const showImage = Boolean(resolvedUrl) && !hasError

    return (
      <div className="flex h-16 w-16 items-center justify-center rounded border border-gray-200 bg-gray-100 text-gray-400">
        {showImage ? (
          <img
            src={resolvedUrl || ''}
            alt={alt}
            className="h-full w-full rounded object-cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <i className="fa-regular fa-image text-lg" aria-hidden="true" />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black/40">
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Order Details</h3>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
          </div>
        </aside>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black/40">
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Order Details</h3>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="py-8 text-center text-sm text-red-600">{error || 'Order not found'}</div>
          </div>
        </aside>
      </div>
    )
  }

  const displayStatus = calculateOrderStatus(order.status, order.payment_status)
  const canConfirmPayment = displayStatus === 'Waiting for Verification'
  const canRejectPayment = displayStatus === 'Waiting for Verification'
  const canCancel = displayStatus === 'Awaiting Payment' || displayStatus === 'Waiting for Verification' || displayStatus === 'Ready for Pickup'
  const canShip = displayStatus === 'Payment Confirmed' && order.shipping_method === 'shipping'
  const canMarkReadyForPickup = displayStatus === 'Payment Confirmed' && order.shipping_method === 'pickup'
  const canRefund = ['Payment Confirmed', 'Preparing', 'Ready for Pickup', 'Completed'].includes(displayStatus)

  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside
          className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
              <p className="text-sm text-gray-500">{order.order_no || order.order_number}</p>
            </div>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              {/* Status and Actions */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Status & Actions</p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <StatusBadge status={displayStatus.toLowerCase()} label={displayStatus} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {canConfirmPayment && (
                      <button
                        onClick={() => setShowConfirmPayment(true)}
                        className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Confirm Payment
                      </button>
                    )}
                    {canRejectPayment && (
                      <button
                        onClick={() => setShowRejectPayment(true)}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject Payment Proof
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => setShowCancel(true)}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Cancel Order
                      </button>
                    )}
                    {canShip && (
                      <button
                        onClick={() => setShowShip(true)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Mark as Shipped
                      </button>
                    )}
                    {canMarkReadyForPickup && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'ready_for_pickup' }),
                            })
                            if (res.ok) {
                              handleOrderUpdated()
                            }
                          } catch (err) {
                            console.error('Failed to mark ready for pickup:', err)
                          }
                        }}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Mark as Ready for Pickup
                      </button>
                    )}
                    {canRefund && (
                      <button
                        onClick={() => setShowRefund(true)}
                        className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Order Information */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Order Information</p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Order Number</p>
                      <p className="font-medium text-gray-900">{order.order_no || order.order_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment Status</p>
                      <p className="font-medium text-gray-900 capitalize">{order.payment_status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Shipping Method</p>
                      <p className="font-medium text-gray-900 capitalize">{order.shipping_method || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment Method</p>
                      <p className="font-medium text-gray-900">{order.payment_info?.payment_method || '-'}</p>
                    </div>
                  </div>
                  {order.notes && (
                    <div>
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="font-medium text-gray-900">{order.notes}</p>
                    </div>
                  )}
                  {order.admin_note && (
                    <div>
                      <p className="text-xs text-gray-500">Admin Note</p>
                      <p className="font-medium text-gray-900">{order.admin_note}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Customer Information */}
              {order.customer && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Customer Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Name</p>
                        <p className="font-medium text-gray-900">{order.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{order.customer.email}</p>
                      </div>
                      {order.customer.phone && (
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="font-medium text-gray-900">{order.customer.phone}</p>
                        </div>
                      )}
                      {order.customer.tier && (
                        <div>
                          <p className="text-xs text-gray-500">Tier</p>
                          <p className="font-medium text-gray-900 capitalize">{order.customer.tier}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Shipping Address */}
              {order.address && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Shipping Address</p>
                  </div>
                  <div className="px-4 py-3 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{order.address.shipping_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{order.address.shipping_phone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium text-gray-900">
                        {order.address.shipping_address_line1 || ''}
                        {order.address.shipping_address_line2 ? `, ${order.address.shipping_address_line2}` : ''}
                      </p>
                      <p className="font-medium text-gray-900">
                        {order.address.shipping_city || ''}
                        {order.address.shipping_state ? `, ${order.address.shipping_state}` : ''}
                        {order.address.shipping_postcode ? ` ${order.address.shipping_postcode}` : ''}
                      </p>
                      <p className="font-medium text-gray-900">{order.address.shipping_country || '-'}</p>
                    </div>
                    {order.shipping_courier && (
                      <div>
                        <p className="text-xs text-gray-500">Courier</p>
                        <p className="font-medium text-gray-900">{order.shipping_courier}</p>
                      </div>
                    )}
                    {order.shipping_tracking_no && (
                      <div>
                        <p className="text-xs text-gray-500">Tracking Number</p>
                        <p className="font-medium text-gray-900">{order.shipping_tracking_no}</p>
                      </div>
                    )}
                    {order.shipped_at && (
                      <div>
                        <p className="text-xs text-gray-500">Shipped At</p>
                        <p className="font-medium text-gray-900">{formatDate(order.shipped_at)}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Order Items */}
              {order.items && order.items.length > 0 && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Order Items</p>
                  </div>
                  <div className="px-4 py-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Product</th>
                          <th className="text-right py-2 px-2">Quantity</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-3">
                                <ProductImage
                                  imagePath={item.product_image}
                                  alt={item.product_name}
                                />
                                <span>{item.product_name}</span>
                              </div>
                            </td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">
                              {item.unit_price ? `RM ${formatAmount(item.unit_price)}` : '-'}
                            </td>
                            <td className="text-right py-2 px-2">RM {formatAmount(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Vouchers */}
              {order.vouchers && order.vouchers.length > 0 && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Vouchers</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-sm">
                    {order.vouchers.map((voucher, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="font-medium">{voucher.code}</span>
                        <span>RM {formatAmount(voucher.discount_amount)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Payment Uploads */}
              {order.uploads && order.uploads.length > 0 && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Payment Proof</p>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-sm">
                    {order.uploads.map((upload) => (
                      <div key={upload.id}>
                        {upload.url ? (
                          <a
                            href={upload.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View Payment Proof
                          </a>
                        ) : (
                          <span>{upload.path}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Order Summary */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Order Summary</p>
                </div>
                <div className="px-4 py-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">RM {formatAmount(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount</span>
                    <span className="font-medium">RM {formatAmount(order.discount_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping Fee</span>
                    <span className="font-medium">RM {formatAmount(order.shipping_fee)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Grand Total</span>
                    <span>RM {formatAmount(order.grand_total)}</span>
                  </div>
                </div>
              </section>

              {/* Refund Information */}
              {order.refunded_at && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Refund Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Refunded At</p>
                      <p className="font-medium text-gray-900">{formatDate(order.refunded_at)}</p>
                    </div>
                    {order.refund_proof_path && (
                      <div>
                        <p className="text-xs text-gray-500">Refund Proof</p>
                        <a
                          href={order.refund_proof_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Refund Proof
                        </a>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showConfirmPayment && (
        <OrderConfirmPaymentModal
          orderId={orderId}
          onClose={() => setShowConfirmPayment(false)}
          onSuccess={handleOrderUpdated}
        />
      )}

      {showRejectPayment && (
        <OrderRejectPaymentModal
          orderId={orderId}
          onClose={() => setShowRejectPayment(false)}
          onSuccess={handleOrderUpdated}
        />
      )}

      {showCancel && (
        <OrderCancelModal
          orderId={orderId}
          onClose={() => setShowCancel(false)}
          onSuccess={handleOrderUpdated}
        />
      )}

      {showShip && (
        <OrderShipModal
          orderId={orderId}
          onClose={() => setShowShip(false)}
          onSuccess={handleOrderUpdated}
        />
      )}

      {showRefund && (
        <OrderRefundModal
          orderId={orderId}
          onClose={() => setShowRefund(false)}
          onSuccess={handleOrderUpdated}
        />
      )}
    </>
  )
}
