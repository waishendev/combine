'use client'

import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import { calculateOrderStatus, detectOrderType } from './orderUtils'
import OrderConfirmPaymentModal from './OrderConfirmPaymentModal'
import OrderRejectPaymentModal from './OrderRejectPaymentModal'
import OrderCancelModal from './OrderCancelModal'
import OrderShipModal from './OrderShipModal'
import OrderRefundModal from './OrderRefundModal'
import OrderCompleteModal from './OrderCompleteModal'
import PosBookingDetailContent from '@/components/pos/PosBookingDetailContent'
import type { PosAppointmentDetail } from '@/components/pos/posAppointmentTypes'

interface OrderViewPanelProps {
  orderId: number
  onClose: () => void
  onOrderUpdated?: (updatedOrder?: OrderDetailData) => void
  zIndexClassName?: string
}

type BookingDetailData = {
  id: number
  booking_code?: string | null
  customer?: {
    id?: number
    name?: string | null
    phone?: string | null
    email?: string | null
  } | null
  guest_name?: string | null
  guest_phone?: string | null
  guest_email?: string | null
  settlement_notes?: string | null
  service?: {
    id?: number
    name?: string | null
    cn_name?: string | null
    duration_min?: number | null
    deposit_amount?: string | number | null
  } | null
  add_ons?: Array<{
    name: string
    cn_name?: string | null
    extra_duration_min?: number | null
    extra_price?: number | string | null
    linked_deposit_amount?: number | string | null
  }>
  staff?: {
    id?: number
    name?: string | null
  } | null
  start_at?: string | null
  end_at?: string | null
  status?: string | null
  payment_status?: string | null
  deposit_paid?: string | number | null
  settlement_paid?: string | number | null
  balance_due?: string | number | null
  package_offset?: string | number | null
  package_claims?: Array<{
    package_name: string
    booking_service_id?: number
    status?: string
  }>
  uploaded_item_photos?: Array<{
    id: number
    file_url: string
    original_name?: string | null
  }>
  service_photos?: Array<{
    id: number
    file_url: string
    caption?: string | null
  }>
}

type BookingOrderLine = {
  display_name: string
  quantity: number
  unit_price?: string | number | null
  line_total: string | number
  booking_id?: number | null
  booking_service_id?: number | null
  booking_service_name?: string | null
  booking_service_cn_name?: string | null
  booking_details?: BookingDetailData | null
}

type BookingOrderGroup = {
  key: string
  bookingId?: number | null
  bookingCode?: string | null
  serviceName?: string | null
  serviceCnName?: string | null
  bookingDetail?: BookingDetailData | null
  deposits: BookingOrderLine[]
  addOns: BookingOrderLine[]
  subtotal: number
}

type OrderDetailData = {
  id: number
  order_no: string
  order_number?: string
  order_type?: string | null
  status: string
  payment_status: string
  subtotal: string
  discount_total: string
  shipping_fee: string
  grand_total: string
  net_total?: string | number
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
  billing_address?: {
    name?: string | null
    phone?: string | null
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
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
    product_variant_id?: number | null
    product_type?: string | null
    is_variant_product?: boolean | null
    product_name: string
    product_cn_name?: string | null
    variant_name?: string | null
    variant_cn_name?: string | null
    variant_sku?: string | null
    quantity: number
    unit_price?: string | null
    line_total: string
    product_image?: string | null
  }>
  service_items?: Array<{
    item_type?: 'service' | string
    service_name: string
    quantity: number
    unit_price?: string | number | null
    line_total: string | number
    assigned_staff_name?: string | null
    start_at?: string | null
    end_at?: string | null
    package_claim_status?: 'reserved' | 'consumed' | 'released' | null
    package_claim_note?: string | null
  }>
  package_items?: Array<{
    item_type?: 'service_package' | string
    service_package_id?: number
    package_name: string
    customer_name?: string | null
    quantity: number
    unit_price?: string | number | null
    line_total: string | number
  }>
  booking_deposit_items?: BookingOrderLine[]
  booking_addon_items?: BookingOrderLine[]
  vouchers?: Array<{
    code: string
    discount_amount: string
  }>
  payment_info?: {
    payment_status: string
    paid_at?: string | null
    payment_method: string
    payment_proof_rejected_at?: string | null
    refund_proof_path?: string | null
    refunded_at?: string | null
    payment_proof_path?: Array<{
      id: number
      type: string
      payment_proof_path: string
      created_at: string
    }>
  }
  admin_note?: string | null
  refund_total?: string | number
  returns?: Array<{
    id: number
    status: string
    reason?: string | null
    requested_at?: string | null
    reviewed_at?: string | null
    received_at?: string | null
    completed_at?: string | null
    items?: Array<{
      order_item_id: number
      product_name: string
      qty: number
    }>
    refund?: {
      status: string
      refunded_at?: string | null
      amount?: string
    }
  }>
}

export default function OrderViewPanel({
  orderId,
  onClose,
  onOrderUpdated,
  zIndexClassName = 'z-50',
}: OrderViewPanelProps) {
  const nestedModalZIndexClassName = zIndexClassName.includes('pos-body-stack-modal')
    ? 'pos-body-stack-modal-top'
    : 'z-[60]'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderDetailData | null>(null)
  const [showConfirmPayment, setShowConfirmPayment] = useState(false)
  const [showRejectPayment, setShowRejectPayment] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showShip, setShowShip] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null)
  const [viewingBookingDetail, setViewingBookingDetail] = useState<BookingDetailData | null>(null)
  const [posAppointmentDetail, setPosAppointmentDetail] = useState<PosAppointmentDetail | null>(null)
  const [posAppointmentLoading, setPosAppointmentLoading] = useState(false)
  const [posAppointmentError, setPosAppointmentError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadOrder = async () => {
      setLoading(true)
      setError(null)
      setOrder(null)
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
        if (controller.signal.aborted) return

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
        if (controller.signal.aborted) return
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load order')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

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

  const PackageBadge = ({ name }: { name: string }) => (
    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
      [PKG] {name}
    </span>
  )

  const getActivePackageClaims = (detail: BookingDetailData | null | undefined) =>
    (detail?.package_claims ?? []).filter((claim) => ['reserved', 'consumed'].includes(String(claim.status)))

  const resolveMainBookingServiceId = (group: BookingOrderGroup) => {
    const candidates = [
      group.bookingDetail?.service?.id,
      ...group.deposits.map((line) => line.booking_service_id),
    ]
    for (const candidate of candidates) {
      const id = Number(candidate ?? 0)
      if (id > 0) return id
    }
    return 0
  }

  const claimForMainService = (detail: BookingDetailData | null | undefined, mainBookingServiceId: number) =>
    getActivePackageClaims(detail).find((claim) => Number(claim.booking_service_id) === Number(mainBookingServiceId))

  const claimForAddonLine = (
    detail: BookingDetailData | null | undefined,
    addonBookingServiceId: number | null | undefined,
    mainBookingServiceId: number,
  ) => {
    const addonId = Number(addonBookingServiceId ?? 0)
    if (!addonId || addonId === mainBookingServiceId) return undefined
    return getActivePackageClaims(detail).find((claim) => Number(claim.booking_service_id) === addonId)
  }

  const toNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 0
    return typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  }

  const getLineAddonCnName = (line: BookingOrderLine, group: BookingOrderGroup) => {
    const lineName = line.display_name.toLowerCase()
    const normalizedLineNames = [
      lineName,
      lineName.replace(/^booking deposit -\s*/i, ''),
      lineName.replace(/^final settlement -\s*/i, ''),
    ].map((value) => value.trim())

    const addOn = group.bookingDetail?.add_ons?.find((item) => {
      const addOnName = item.name.toLowerCase().trim()
      return normalizedLineNames.some((candidate) => candidate === addOnName || candidate.endsWith(addOnName))
    })

    return addOn?.cn_name ?? null
  }

  const openBookingGroupDetail = async (group: BookingOrderGroup) => {
    if (!group.bookingId) return

    setViewingBookingDetail(
      group.bookingDetail ?? {
        id: group.bookingId,
        booking_code: group.bookingCode,
        service: {
          name: group.serviceName ?? null,
          cn_name: group.serviceCnName ?? null,
        },
      },
    )
    setPosAppointmentDetail(null)
    setPosAppointmentError(null)
    setPosAppointmentLoading(true)

    try {
      const res = await fetch(`/api/proxy/pos/appointments/${group.bookingId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(String(json?.message ?? 'Unable to load booking detail.'))
      }
      setPosAppointmentDetail((json?.data ?? null) as PosAppointmentDetail | null)
    } catch (err) {
      setPosAppointmentError(err instanceof Error ? err.message : 'Unable to load booking detail.')
    } finally {
      setPosAppointmentLoading(false)
    }
  }

  const closeBookingGroupDetail = () => {
    setViewingBookingDetail(null)
    setPosAppointmentDetail(null)
    setPosAppointmentError(null)
    setPosAppointmentLoading(false)
  }

  const bookingGroupLabel = (group: BookingOrderGroup) =>
    group.bookingCode
    || group.bookingDetail?.booking_code
    || (group.bookingId ? `Booking #${group.bookingId}` : 'Booking')

  const formatPaymentMethod = (method: string | null | undefined) => {
    if (!method) return '-'
    switch (method) {
      case 'billplz_fpx':
        return 'Online Banking'
      case 'billplz_card':
        return 'Credit Card'
      case 'manual_transfer':
        return 'Manual Transfer'
      default:
        return method
    }
  }

  const formatReturnStatus = (status: string | null | undefined) => {
    if (!status) return '-'
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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
      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
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

  const BrokenImagePlaceholder = () => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50">
      <div className="text-center">
        <i className="fa-regular fa-image mb-2 text-4xl text-slate-400" aria-hidden="true" />
        <p className="text-xs text-slate-500">Image failed to load</p>
      </div>
    </div>
  )

  const ProofImage = ({ imageUrl, alt }: { imageUrl: string; alt: string }) => {
    const [hasError, setHasError] = useState(false)
    
    if (hasError) {
      return <BrokenImagePlaceholder />
    }

    return (
      <a
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full max-h-64 cursor-pointer rounded-lg border border-slate-200 object-contain transition-opacity hover:opacity-90"
          onError={() => setHasError(true)}
        />
      </a>
    )
  }

  if (loading) {
    return (
      <div className={`fixed inset-0 ${zIndexClassName} flex h-[100dvh] max-h-[100dvh] bg-black/40`}>
        <div className="hidden min-h-0 flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Order Details</h3>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="py-8 text-center text-sm text-slate-500">Loading order details...</div>
          </div>
        </aside>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className={`fixed inset-0 ${zIndexClassName} flex h-[100dvh] max-h-[100dvh] bg-black/40`}>
        <div className="hidden min-h-0 flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Order Details</h3>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="py-8 text-center text-sm text-red-600">{error || 'Order not found'}</div>
          </div>
        </aside>
      </div>
    )
  }

  const orderType = detectOrderType(order)
  const displayStatus = calculateOrderStatus(order.status, order.payment_status, orderType)
  const isBookingOrder = orderType === 'booking'
  const isMixedOrder = orderType === 'mixed'
  const netTotal =
    toNumber(order.net_total) || toNumber(order.grand_total) - toNumber(order.refund_total)
  const canConfirmPayment = displayStatus === 'Waiting for Verification'
  const canRejectPayment = displayStatus === 'Waiting for Verification'
  const canCancel = (!isBookingOrder && (displayStatus === 'Awaiting Payment' || displayStatus === 'Waiting for Verification' || displayStatus === 'Ready for Pickup')) || (isBookingOrder && order.payment_status !== 'paid' && (displayStatus === 'Awaiting Payment' || displayStatus === 'Waiting for Verification'))
  const canShip = !isBookingOrder && displayStatus === 'Payment Confirmed' && order.shipping_method === 'shipping'
  const canMarkReadyForPickup = !isBookingOrder && displayStatus === 'Payment Confirmed' && order.shipping_method === 'pickup'
  // const canRefund = ['Payment Confirmed', 'Preparing', 'Ready for Pickup', 'Completed'].includes(displayStatus)
  const canDownloadInvoice = order.status === 'completed'
  const canComplete =
    !isBookingOrder && ((order.status === 'ready_for_pickup' && order.payment_status === 'paid') || order.status === 'shipped')
  const invoiceUrl = `/api/proxy/ecommerce/orders/${order.id}/invoice`

  const hasProductItems = (order.items?.length ?? 0) > 0
  const hasServiceItems = (order.service_items?.length ?? 0) > 0
  const hasPackageItems = (order.package_items?.length ?? 0) > 0
  const hasBookingDepositItems = (order.booking_deposit_items?.length ?? 0) > 0
  const hasBookingAddonItems = (order.booking_addon_items?.length ?? 0) > 0
  const bookingOrderGroups = (() => {
    const groups = new Map<string, BookingOrderGroup>()

    const ensureGroup = (line: BookingOrderLine, fallbackKey: string) => {
      const key = line.booking_id ? `booking-${line.booking_id}` : fallbackKey
      const existing = groups.get(key)

      if (existing) {
        existing.serviceName ||= line.booking_details?.service?.name || line.booking_service_name
        existing.serviceCnName ||= line.booking_details?.service?.cn_name || line.booking_service_cn_name
        existing.bookingDetail ||= line.booking_details
        existing.bookingCode ||= line.booking_details?.booking_code
        return existing
      }

      const group: BookingOrderGroup = {
        key,
        bookingId: line.booking_id,
        bookingCode: line.booking_details?.booking_code,
        serviceName: line.booking_details?.service?.name || line.booking_service_name,
        serviceCnName: line.booking_details?.service?.cn_name || line.booking_service_cn_name,
        bookingDetail: line.booking_details,
        deposits: [],
        addOns: [],
        subtotal: 0,
      }
      groups.set(key, group)
      return group
    }

    order.booking_deposit_items?.forEach((line, index) => {
      const group = ensureGroup(line, `deposit-${index}`)
      group.deposits.push(line)
      group.subtotal += toNumber(line.line_total)
    })

    order.booking_addon_items?.forEach((line, index) => {
      const group = ensureGroup(line, `addon-${index}`)
      group.addOns.push(line)
      group.subtotal += toNumber(line.line_total)
    })

    return Array.from(groups.values())
  })()

  const bookingOrderGuestContact = (() => {
    if (order.customer) {
      return {
        name: order.customer.name,
        phone: order.customer.phone ?? order.billing_address?.phone ?? '—',
        email: order.customer.email ?? '—',
      }
    }
    const firstBooking = bookingOrderGroups[0]?.bookingDetail
    return {
      name: firstBooking?.customer?.name || firstBooking?.guest_name || order.billing_address?.name || '—',
      phone: firstBooking?.customer?.phone || firstBooking?.guest_phone || order.billing_address?.phone || '—',
      email: firstBooking?.customer?.email || firstBooking?.guest_email || '—',
    }
  })()

  const cleanBookingLineName = (name?: string | null) =>
    String(name ?? '')
      .replace(/^booking\s+(deposit|add-on)\s*[-–:]\s*/i, '')
      .trim()

  const formatAddonLineName = (line: BookingOrderLine) =>
    cleanBookingLineName(line.booking_service_name || line.display_name || 'Add-on')

  const bookingDepositTotal = bookingOrderGroups.reduce((sum, group) => sum + group.subtotal, 0)

  const resolveMainServiceAmounts = (group: BookingOrderGroup, mainClaim?: { package_name: string }) => {
    const depositFromLines = group.deposits.reduce((sum, line) => sum + toNumber(line.line_total), 0)
    const serviceDepositDue = toNumber(group.bookingDetail?.service?.deposit_amount)
    const depositDue = depositFromLines > 0.0001 ? depositFromLines : serviceDepositDue
    const covered = Boolean(mainClaim) || Number(group.bookingDetail?.package_offset ?? 0) > 0.0001

    if (covered) {
      return { covered: true, originalAmount: depositDue, finalAmount: 0 }
    }

    return { covered: false, originalAmount: depositDue, finalAmount: depositDue }
  }

  const resolveAddonDepositAmount = (item: BookingOrderLine, group: BookingOrderGroup) => {
    const depositFromLine = toNumber(item.line_total) || toNumber(item.unit_price)
    if (depositFromLine > 0.0001) return depositFromLine

    const lineName = formatAddonLineName(item).toLowerCase()
    const matchedAddon = group.bookingDetail?.add_ons?.find((addon) => {
      const addonName = addon.name.toLowerCase().trim()
      return addonName === lineName || lineName.endsWith(addonName) || addonName.endsWith(lineName)
    })
    return toNumber(matchedAddon?.linked_deposit_amount)
  }

  const renderLineAmount = (covered: boolean, originalAmount: number, finalAmount: number) => {
    if (covered) {
      if (originalAmount > 0.0001) {
        return (
          <div className="shrink-0 text-right text-sm leading-tight">
            <p className="text-slate-400 line-through">RM {formatAmount(originalAmount)}</p>
            <p className="mt-0.5 font-medium text-slate-900">RM {formatAmount(finalAmount)}</p>
          </div>
        )
      }

      return (
        <div className="shrink-0 text-right text-sm font-medium text-slate-900">
          RM {formatAmount(finalAmount)}
        </div>
      )
    }

    if (finalAmount > 0.0001) {
      return (
        <div className="shrink-0 text-right text-sm font-medium text-slate-900">
          RM {formatAmount(finalAmount)}
        </div>
      )
    }

    return null
  }

  return (
    <>
      <div className={`fixed inset-0 ${zIndexClassName} flex h-[100dvh] max-h-[100dvh] bg-black/40`} role="dialog" aria-modal="true">
        <div className="hidden min-h-0 flex-1 bg-black/40 md:block" />
        <aside
          className="relative ml-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{isBookingOrder ? 'Booking Order Details' : 'Order Details'}</h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isBookingOrder
                    ? 'bg-indigo-100 text-indigo-700'
                    : isMixedOrder
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                }`}>
                  {isBookingOrder ? 'Booking' : isMixedOrder ? 'Mixed' : 'Ecommerce'}
                </span>
              </div>
              <p className="text-sm text-slate-500">{order.order_no || order.order_number}</p>
            </div>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="space-y-5">

              {/* Order Items */}
              {(hasProductItems || hasServiceItems || hasPackageItems || hasBookingDepositItems || hasBookingAddonItems) && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{isBookingOrder ? 'Booking Order Details' : 'Order Details'}</p>
                  </div>
                  <div className="space-y-4 px-4 py-3 text-sm">
                    {isBookingOrder ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer / Guest</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <p className="text-xs text-slate-500">Name</p>
                            <p className="font-medium text-slate-900">{bookingOrderGuestContact.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="font-medium text-slate-900">{bookingOrderGuestContact.phone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Email</p>
                            <p className="font-medium text-slate-900">{bookingOrderGuestContact.email}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {hasProductItems && !isBookingOrder && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2 text-left font-medium">Product</th>
                                <th className="px-2 py-2 text-right font-medium">Quantity</th>
                                <th className="px-2 py-2 text-right font-medium">Unit Price</th>
                                <th className="px-2 py-2 text-right font-medium">Total</th>
                                <th className="px-2 py-2 text-left font-medium">Package Claim</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item, idx) => (
                                <tr key={`product-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="py-2 px-2">
                                    <div className="flex items-center gap-3">
                                      <ProductImage
                                        imagePath={item.product_image}
                                        alt={item.product_name}
                                      />
                                      <div>
                                        <div className="font-medium text-slate-900">{item.product_name}</div>
                                        {item.product_cn_name ? <div className="text-xs text-slate-500">{item.product_cn_name}</div> : null}
                                        {(item.product_type === 'variant' || item.product_variant_id) && (
                                          <div className="text-xs text-slate-500">
                                            <div>Variant: {item.variant_name ?? '—'}</div>
                                            {item.variant_cn_name ? <div>{item.variant_cn_name}</div> : null}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-right text-slate-700">{item.quantity}</td>
                                  <td className="px-2 py-2 text-right text-slate-700">
                                    {item.unit_price ? `RM ${formatAmount(item.unit_price)}` : '-'}
                                  </td>
                                  <td className="px-2 py-2 text-right font-medium text-slate-900">
                                    RM {formatAmount(item.line_total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {hasServiceItems && !isBookingOrder && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2 text-left font-medium">Service</th>
                                <th className="px-2 py-2 text-left font-medium">Staff</th>
                                <th className="px-2 py-2 text-right font-medium">Quantity</th>
                                <th className="px-2 py-2 text-right font-medium">Unit Price</th>
                                <th className="px-2 py-2 text-right font-medium">Total</th>
                                <th className="px-2 py-2 text-left font-medium">Package Claim</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.service_items?.map((item, idx) => (
                                <tr key={`service-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-2 py-2 text-slate-900">{item.service_name || 'Service'}</td>
                                  <td className="px-2 py-2 text-slate-700">{item.assigned_staff_name || '-'}</td>
                                  <td className="px-2 py-2 text-right text-slate-700">{item.quantity}</td>
                                  <td className="px-2 py-2 text-right text-slate-700">
                                    {item.unit_price !== null && item.unit_price !== undefined ? `RM ${formatAmount(item.unit_price)}` : '-'}
                                  </td>
                                  <td className="px-2 py-2 text-right font-medium text-slate-900">RM {formatAmount(item.line_total)}</td>
                                  <td className="px-2 py-2 text-slate-700">
                                    {item.package_claim_status === 'reserved' ? 'Package Applied (Reserved)' : item.package_claim_status === 'consumed' ? 'Consumed from package' : item.package_claim_status === 'released' ? 'Package reservation released' : '-'}
                                    {item.package_claim_note ? <p className="text-xs text-slate-500">{item.package_claim_note}</p> : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {hasPackageItems && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Service Packages</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-600">
                                <th className="px-2 py-2 text-left font-medium">Package</th>
                                <th className="px-2 py-2 text-left font-medium">Member</th>
                                <th className="px-2 py-2 text-right font-medium">Quantity</th>
                                <th className="px-2 py-2 text-right font-medium">Unit Price</th>
                                <th className="px-2 py-2 text-right font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.package_items?.map((item, idx) => (
                                <tr key={`package-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="px-2 py-2 text-slate-900">{item.package_name || 'Service Package'}</td>
                                  <td className="px-2 py-2 text-slate-700">{item.customer_name || '-'}</td>
                                  <td className="px-2 py-2 text-right text-slate-700">{item.quantity}</td>
                                  <td className="px-2 py-2 text-right text-slate-700">
                                    {item.unit_price !== null && item.unit_price !== undefined ? `RM ${formatAmount(item.unit_price)}` : '-'}
                                  </td>
                                  <td className="px-2 py-2 text-right font-medium text-slate-900">RM {formatAmount(item.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {bookingOrderGroups.length > 0 && (
                      <div className="space-y-4">
                          {bookingOrderGroups.map((group) => {
                            const mainBookingServiceId = resolveMainBookingServiceId(group)
                            const mainClaim = mainBookingServiceId
                              ? claimForMainService(group.bookingDetail, mainBookingServiceId)
                              : undefined
                            const mainServiceAmounts = resolveMainServiceAmounts(group, mainClaim)

                            return (
                              <div key={group.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                                <div>
                                  <p className="font-mono text-sm font-semibold text-slate-900">{bookingGroupLabel(group)}</p>
                                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-amber-700">Deposit</p>
                                </div>
                                {group.bookingId ? (
                                  <button
                                    type="button"
                                    onClick={() => void openBookingGroupDetail(group)}
                                    className="inline-flex shrink-0 items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                                    aria-label={`View booking ${bookingGroupLabel(group)}`}
                                    title="View booking details"
                                  >
                                    <i className="fa-solid fa-eye" />
                                    View
                                  </button>
                                ) : null}
                              </div>

                              {group.serviceName ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Service</p>
                                  <div className="flex items-start justify-between gap-4 text-sm text-slate-700">
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-900">{group.serviceName}</p>
                                      {group.serviceCnName ? (
                                        <p className="mt-0.5 text-slate-600">{group.serviceCnName}</p>
                                      ) : null}
                                      {mainClaim ? <PackageBadge name={mainClaim.package_name} /> : null}
                                    </div>
                                    {renderLineAmount(
                                      mainServiceAmounts.covered,
                                      mainServiceAmounts.originalAmount,
                                      mainServiceAmounts.finalAmount,
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {group.addOns.length > 0 && (
                                <div className="mt-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add-ons</p>
                                  <div className="space-y-3">
                                    {group.addOns.map((item, idx) => {
                                      const addonCnName = getLineAddonCnName(item, group)
                                      const addonClaim = claimForAddonLine(
                                        group.bookingDetail,
                                        item.booking_service_id,
                                        mainBookingServiceId,
                                      )
                                      const addonCovered = Boolean(addonClaim)
                                      const addonDepositDue = resolveAddonDepositAmount(item, group)
                                      const addonFinalAmount = addonCovered ? 0 : addonDepositDue

                                      return (
                                        <div key={`addon-${group.key}-${idx}`} className="flex items-start justify-between gap-4 text-sm text-slate-700">
                                          <div className="min-w-0">
                                            <p className="font-medium text-slate-900">{formatAddonLineName(item)}</p>
                                            {addonCnName ? (
                                              <p className="mt-0.5 text-slate-600">{addonCnName}</p>
                                            ) : null}
                                            {addonClaim ? <PackageBadge name={addonClaim.package_name} /> : null}
                                          </div>
                                          {renderLineAmount(addonCovered, addonDepositDue, addonFinalAmount)}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Order Summary */}
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{isBookingOrder ? 'Payment Summary' : 'Order Summary'}</p>
                </div>
                <div className="space-y-2 px-4 py-3 text-sm">
                  {isBookingOrder ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Deposit</span>
                        <span className="font-medium text-slate-900">
                          RM {formatAmount(bookingDepositTotal || order.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                        <span className="text-slate-900">Paid Total</span>
                        <span className="text-slate-900">RM {formatAmount(order.grand_total)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium text-slate-900">RM {formatAmount(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-slate-900">RM {formatAmount(order.discount_total)}</span>
                  </div>
                  {!isBookingOrder && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shipping Fee</span>
                      <span className="font-medium text-slate-900">RM {formatAmount(order.shipping_fee)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-900">Paid Total</span>
                      <span className="font-medium text-slate-900">RM {formatAmount(order.grand_total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Refunded</span>
                      <span className="font-medium text-slate-900">
                        - RM {formatAmount(order.refund_total ?? 0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                    <span className="text-slate-900">Net Total</span>
                    <span className="text-slate-900">RM {formatAmount(netTotal)}</span>
                  </div>
                    </>
                  )}
                </div>
              </section>

              {/* Payment Proof and Refund Proof - Flex Layout */}
              <div className="flex flex-col gap-5 lg:flex-row">
                {/* Payment Proof */}
                <section className="flex-1 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Payment Proof</p>
                  </div>
                  <div className="space-y-3 px-4 py-3 text-sm">
                    {order.payment_info?.payment_proof_path && order.payment_info.payment_proof_path.length > 0 ? (
                      <div className="space-y-3">
                        {order.payment_info.payment_proof_path.map((proof) => (
                          <div key={proof.id}>
                            <ProofImage imageUrl={proof.payment_proof_path} alt="Payment Proof" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500">-</div>
                    )}
                    <div className="border-t border-slate-200 pt-2">
                      <p className="text-xs text-slate-500">Notes</p>
                      <p className="font-medium text-slate-900">{order.notes || '-'}</p>
                    </div>
                  </div>
                </section>

                {/* Admin Refund Proof */}
                <section className="flex-1 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Admin Refund Proof</p>
                  </div>
                  <div className="space-y-3 px-4 py-3 text-sm">
                    {order.payment_info?.refund_proof_path ? (
                      <div>
                        <ProofImage 
                          imageUrl={getImageUrl(order.payment_info.refund_proof_path) || ''} 
                          alt="Refund Proof" 
                        />
                      </div>
                    ) : (
                      <div className="text-slate-500">-</div>
                    )}
                    <div className="border-t border-slate-200 pt-2">
                      <p className="text-xs text-slate-500">Admin Note</p>
                      <p className="font-medium text-slate-900">{order.admin_note || '-'}</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Order Information */}
              {!isBookingOrder && (
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Order Information</p>
                </div>
                <div className="space-y-3 px-4 py-3 text-sm">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Order Number</p>
                      <p className="font-medium text-slate-900">{order.order_no || order.order_number}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-500">Status</p>
                      <StatusBadge status={displayStatus.toLowerCase()} label={displayStatus} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Payment Method</p>
                      <p className="font-medium text-slate-900">{formatPaymentMethod(order.payment_info?.payment_method)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Shipping Method</p>
                      <p className="font-medium text-slate-900">
                        {order.shipping_method === 'in_store'
                          ? 'In-store'
                          : order.shipping_method === 'pickup'
                            ? 'Pickup'
                            : order.shipping_method === 'shipping'
                              ? 'Shipping'
                              : order.shipping_method
                                ? order.shipping_method.replace(/_/g, ' ')
                                : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Invoice</p>
                      {canDownloadInvoice ? (
                        <a
                          href={invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          Download Invoice
                        </a>
                      ) : (
                        <p className="font-medium text-slate-900">-</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
              )}

              {/* Customer Information */}
              {order.customer && !isBookingOrder && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Customer Information</p>
                  </div>
                  <div className="space-y-3 px-4 py-3 text-sm">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">Name</p>
                        <p className="font-medium text-slate-900">{order.customer.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="font-medium text-slate-900">{order.customer.email}</p>
                      </div>
                      {order.customer.phone && (
                        <div>
                          <p className="text-xs text-slate-500">Phone</p>
                          <p className="font-medium text-slate-900">{order.customer.phone}</p>
                        </div>
                      )}
                      {order.customer.tier && (
                        <div>
                          <p className="text-xs text-slate-500">Tier</p>
                          <p className="font-medium text-slate-900 capitalize">{order.customer.tier}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Shipping Address */}
              {order.address && !isBookingOrder && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  {/* Header */}
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Shipping Information
                    </p>
                  </div>

                  <div className="space-y-3 px-4 py-3 text-sm">
                    {/* Name */}
                    <div>
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="font-medium text-slate-900">
                        {order.address.shipping_name || "-"}
                      </p>
                    </div>

                    {/* Phone */}
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium text-slate-900">
                        {order.address.shipping_phone || "-"}
                      </p>
                    </div>

                    {/* Address */}
                    <div>
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="font-medium text-slate-900">
                        {order.address.shipping_address_line1 || ""}
                        {order.address.shipping_address_line2
                          ? `, ${order.address.shipping_address_line2}`
                          : ""}
                      </p>
                      <p className="font-medium text-slate-900">
                        {order.address.shipping_city || ""}
                        {order.address.shipping_state
                          ? `, ${order.address.shipping_state}`
                          : ""}
                        {order.address.shipping_postcode
                          ? ` ${order.address.shipping_postcode}`
                          : ""}
                      </p>
                      <p className="font-medium text-slate-900">
                        {order.address.shipping_country || "-"}
                      </p>
                    </div>

                    {/* Divider */}
                    {(order.shipping_courier ||
                      order.shipping_tracking_no ||
                      order.shipped_at) && (
                      <div className="pt-2">
                        <div className="border-t border-slate-200" />
                      </div>
                    )}

                    {/* Logistics */}
                    {(order.shipping_courier ||
                      order.shipping_tracking_no ||
                      order.shipped_at) && (
                      <div className="space-y-3 pt-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Logistics
                        </p>

                        {order.shipping_courier && (
                          <div>
                            <p className="text-xs text-slate-500">Courier</p>
                            <p className="font-medium text-slate-900">
                              {order.shipping_courier}
                            </p>
                          </div>
                        )}

                        {order.shipping_tracking_no && (
                          <div>
                            <p className="text-xs text-slate-500">Tracking Number</p>
                            <p className="font-medium text-slate-900">
                              {order.shipping_tracking_no}
                            </p>
                          </div>
                        )}

                        {order.shipped_at && (
                          <div>
                            <p className="text-xs text-slate-500">Shipped At</p>
                            <p className="font-medium text-slate-900">
                              {formatDate(order.shipped_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {!isBookingOrder && (
              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Returns</p>
                </div>
                <div className="space-y-4 px-4 py-3 text-sm">
                  {!order.returns || order.returns.length === 0 ? (
                    <p className="text-slate-500">No return requests</p>
                  ) : (
                    order.returns.map((returnRequest) => {
                      const orderNumber = order.order_no || order.order_number || ''
                      const refundStatus =
                        returnRequest.refund?.status ||
                        (order.payment_status === 'refunded' ? 'refunded' : 'not_refunded')
                      const refundLabel =
                        refundStatus === 'refunded' ? 'Refunded' : 'Not Refunded'

                      return (
                        <div
                          key={returnRequest.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  Return #{returnRequest.id}
                                </p>
                                <StatusBadge
                                  status={returnRequest.status?.toLowerCase() || ''}
                                  label={formatReturnStatus(returnRequest.status)}
                                />
                              </div>
                              <p className="text-xs text-slate-500">
                                Requested: {formatDate(returnRequest.requested_at)}
                              </p>
                            </div>
                            <a
                              href={`/returns?order_no=${encodeURIComponent(orderNumber)}`}
                              className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              View Return
                            </a>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div>
                              <p className="text-xs text-slate-500">Reason</p>
                              <p className="font-medium text-slate-900">
                                {returnRequest.reason || '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Items</p>
                              {returnRequest.items && returnRequest.items.length > 0 ? (
                                <ul className="mt-1 space-y-1">
                                  {returnRequest.items.map((item) => (
                                    <li key={`${returnRequest.id}-${item.order_item_id}`}>
                                      <span className="font-medium text-slate-900">
                                        {item.product_name || 'Item'}
                                      </span>{' '}
                                      <span className="text-slate-600">× {item.qty}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-slate-500">-</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Refund Status</p>
                              <StatusBadge status={refundStatus} label={refundLabel} />
                            </div>
                            {returnRequest.refund?.amount &&
                              toNumber(returnRequest.refund.amount) > 0 && (
                                <div>
                                  <p className="text-xs text-slate-500">Refund Amount</p>
                                  <p className="font-medium text-slate-900">
                                    RM {formatAmount(returnRequest.refund.amount)}
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
              )}

              {/* Vouchers */}
              {order.vouchers && order.vouchers.length > 0 && (
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Vouchers</p>
                  </div>
                  <div className="space-y-2 px-4 py-3 text-sm">
                    {order.vouchers.map((voucher, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="font-medium text-slate-900">{voucher.code}</span>
                        <span className="text-slate-700">RM {formatAmount(voucher.discount_amount)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Fixed Bottom Action Buttons */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-lg">
            <div className="flex flex-wrap gap-2">
              {completeSuccess && (
                <div className="w-full rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700" role="status">
                  {completeSuccess}
                </div>
              )}
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
              {/* {canRefund && (
                <button
                  onClick={() => setShowRefund(true)}
                  className="px-4 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Refund
                </button>
              )} */}
              {canComplete && (
                <button
                  onClick={() => {
                    setCompleteSuccess(null)
                    setShowComplete(true)
                  }}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {viewingBookingDetail && (
        <div
          className={`fixed inset-0 ${nestedModalZIndexClassName} flex items-center justify-end bg-black/50`}
          role="dialog"
          aria-modal="true"
        >
          <aside
            className="relative ml-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Booking Detail</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {posAppointmentDetail?.booking_code
                    || viewingBookingDetail.booking_code
                    || `Booking #${viewingBookingDetail.id}`}
                </h3>
                <p className="text-sm text-slate-500">{viewingBookingDetail.service?.name || '-'}</p>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={closeBookingGroupDetail}
                aria-label="Close booking details"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              <PosBookingDetailContent
                detail={posAppointmentDetail}
                loading={posAppointmentLoading}
                error={posAppointmentError}
              />
            </div>
          </aside>
        </div>
      )}

      {showConfirmPayment && (
        <OrderConfirmPaymentModal
          orderId={orderId}
          linkedBookingCount={isBookingOrder ? bookingOrderGroups.length : 0}
          onClose={() => setShowConfirmPayment(false)}
          onSuccess={handleOrderUpdated}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {showRejectPayment && (
        <OrderRejectPaymentModal
          orderId={orderId}
          onClose={() => setShowRejectPayment(false)}
          onSuccess={handleOrderUpdated}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {showCancel && (
        <OrderCancelModal
          orderId={orderId}
          onClose={() => setShowCancel(false)}
          onSuccess={handleOrderUpdated}
          isBookingOrder={isBookingOrder}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {showShip && (
        <OrderShipModal
          orderId={orderId}
          onClose={() => setShowShip(false)}
          onSuccess={handleOrderUpdated}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {showRefund && (
        <OrderRefundModal
          orderId={orderId}
          onClose={() => setShowRefund(false)}
          onSuccess={handleOrderUpdated}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {showComplete && (
        <OrderCompleteModal
          orderId={orderId}
          onClose={() => setShowComplete(false)}
          onSuccess={async () => {
            await handleOrderUpdated()
            setCompleteSuccess('Order marked as completed.')
          }}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}
    </>
  )
}
