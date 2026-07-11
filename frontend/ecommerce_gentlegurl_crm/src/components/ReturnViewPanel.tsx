'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'

import { IMAGE_PDF_ACCEPT } from './mediaAccept'

type ReturnRefundMethod = 'cash' | 'customer_credit'

const RETURN_REFUND_METHODS: Array<{ method: ReturnRefundMethod; label: string }> = [
  { method: 'cash', label: 'Cash Refund' },
  { method: 'customer_credit', label: 'Customer Credit' },
]

type ReturnItem = {
  product_id?: number
  product_name?: string | null
  product_cn_name?: string | null
  quantity?: number | null
  unit_price?: string | number | null
  line_total?: string | number | null
  product_image?: string | null
  cover_image_url?: string | null
  product_variant_id?: number | null
  product_type?: string | null
  is_variant_product?: boolean | null
  variant_name?: string | null
  variant_cn_name?: string | null
  variant_sku?: string | null
  product_sku?: string | null
  // Legacy fields for backward compatibility
  order_item_id?: number
  product_name_snapshot?: string | null
  sku_snapshot?: string | null
  requested_quantity?: number | null
}

type ReturnDetail = {
  id: number
  order?: {
    id?: number
    order_number?: string | null
    placed_at?: string | null
    status?: string | null
    grand_total?: number | string | null
  }
  customer?: {
    name?: string | null
    email?: string | null
    phone?: string | null
  }
  request_type?: string | null
  status?: string | null
  reason?: string | null
  description?: string | null
  admin_note?: string | null
  initial_image_urls?: string[] | null
  return_courier_name?: string | null
  return_tracking_no?: string | null
  return_shipped_at?: string | null
  refund_amount?: string | number | null
  refund_method?: string | null
  refund_proof_path?: string | null
  refund_proof_url?: string | null
  refunded_at?: string | null
  refund?: {
    id?: number
    refund_no?: string | null
    receipt_public_url?: string | null
  } | null
  items?: ReturnItem[]
  timeline?: {
    created_at?: string | null
    reviewed_at?: string | null
    received_at?: string | null
    completed_at?: string | null
  }
}

interface ReturnViewPanelProps {
  returnId: number
  onClose: () => void
  onReturnUpdated?: () => void
  zIndexClassName?: string
}

const isAdminNoteRequired = (action: string) => action === 'reject' || action === 'cancel'

function confirmModalTitle(action: string): string {
  switch (action) {
    case 'approve':
      return 'Approve Return Request'
    case 'reject':
      return 'Reject Return Request'
    case 'mark_in_transit':
      return 'Mark Return In Transit'
    case 'mark_received':
      return 'Mark Return Received'
    default:
      return 'Confirm Action'
  }
}

function confirmModalSubmitLabel(action: string): string {
  switch (action) {
    case 'approve':
      return 'Approve'
    case 'reject':
      return 'Reject'
    case 'mark_in_transit':
      return 'Mark in transit'
    case 'mark_received':
      return 'Mark received'
    default:
      return 'Confirm'
  }
}

function confirmModalSubmitClass(action: string): string {
  switch (action) {
    case 'approve':
      return 'bg-emerald-600 hover:bg-emerald-700'
    case 'reject':
      return 'bg-rose-600 hover:bg-rose-700'
    case 'mark_in_transit':
      return 'bg-violet-600 hover:bg-violet-700'
    case 'mark_received':
      return 'bg-teal-600 hover:bg-teal-700'
    default:
      return 'bg-slate-800 hover:bg-slate-900'
  }
}

function ReturnActionConfirmModal({
  action,
  orderNo,
  onClose,
  onConfirm,
  zIndexClassName,
}: {
  action: string
  orderNo?: string | null
  onClose: () => void
  onConfirm: (adminNote: string) => Promise<void>
  zIndexClassName: string
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const noteRequired = isAdminNoteRequired(action)

  const handleSubmit = async () => {
    if (noteRequired && !note.trim()) {
      setError('Admin note is required for this action.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(note.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-slate-950/50 p-4`}>
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-950">{confirmModalTitle(action)}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {orderNo ? `Order ${orderNo}` : 'Return request'}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Admin note {noteRequired ? <span className="text-red-500">*</span> : '(optional)'}
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder={noteRequired ? 'Reason for staff audit trail' : 'Note for audit trail or customer communication'}
            disabled={submitting}
          />
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${confirmModalSubmitClass(action)}`}
          >
            {submitting ? 'Processing…' : confirmModalSubmitLabel(action)}
          </button>
        </div>
      </div>
    </div>
  )
}

const badgeStyle = (status: string) => {
  switch (status) {
    case 'requested':
      return 'bg-amber-100 text-amber-800'
    case 'approved':
      return 'bg-sky-100 text-sky-800'
    case 'in_transit':
      return 'bg-violet-100 text-violet-800'
    case 'received':
      return 'bg-cyan-100 text-cyan-800'
    case 'refunded':
      return 'bg-green-100 text-green-800'
    case 'rejected':
      return 'bg-rose-100 text-rose-800'
    case 'cancelled':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

const normalizeStatus = (status?: string | null) => {
  if (!status) return ''
  return status.toLowerCase().replace(/\s+/g, '_')
}

const formatStatusLabel = (status?: string | null) => {
  if (!status) return '—'
  return normalizeStatus(status)
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const formatAmount = (value?: string | number | null) => {
  if (value === null || value === undefined) return '0.00'
  const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (Number.isNaN(num)) return '0.00'
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const getFileUrl = (path?: string | null) => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
  if (path.startsWith('/')) {
    return `${baseUrl}${path}`
  }
  return `${baseUrl}/storage/${path}`
}

const isVideoUrl = (value?: string | null) => {
  if (!value) return false
  const lower = value.toLowerCase().split('?')[0]
  return ['.mp4', '.mov', '.webm', '.m4v', '.ogv'].some((ext) => lower.endsWith(ext))
}

const isEmbeddedVideoUrl = (value?: string | null) => {
  if (!value) return false
  const lower = value.toLowerCase()
  return lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('vimeo.com')
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
  // Otherwise, assume it's a storage path
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
        <i className="fa-solid fa-image text-xl" />
      )}
    </div>
  )
}

export default function ReturnViewPanel({
  returnId,
  onClose,
  onReturnUpdated,
  zIndexClassName = 'z-50',
}: ReturnViewPanelProps) {
  const nestedModalZIndexClassName = zIndexClassName.includes('pos-body-stack-modal')
    ? 'pos-body-stack-modal-top'
    : 'z-[60]'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundReceipt, setRefundReceipt] = useState<{ url: string; refundNo?: string } | null>(null)
  const refundProofUrl = detail
    ? getFileUrl(detail.refund_proof_url ?? detail.refund_proof_path)
    : null

  useEffect(() => {
    const controller = new AbortController()

    const fetchDetail = async () => {
      setLoading(true)
      setError(null)
      setDetail(null)
      setConfirmAction(null)
      setShowRefundModal(false)
      setRefundReceipt(null)

      try {
        const res = await fetch(`/api/proxy/ecommerce/returns/${returnId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setError('Unable to load return details.')
          return
        }

        const json = await res.json().catch(() => null)
        setDetail(json?.data ?? null)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setError('Unable to load return details.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void fetchDetail()

    return () => controller.abort()
  }, [returnId])

  const handleReturnUpdated = async () => {
    const controller = new AbortController()
    try {
      const res = await fetch(`/api/proxy/ecommerce/returns/${returnId}`, {
        cache: 'no-store',
        signal: controller.signal,
      })

      if (res.ok) {
        const json = await res.json().catch(() => null)
        setDetail(json?.data ?? null)
        onReturnUpdated?.()
      }
    } catch (err) {
      console.error('Failed to reload return:', err)
      onReturnUpdated?.()
    }
  }

  const applyAction = async (action: string, adminNote: string) => {
    if (!returnId) return

    const res = await fetch(`/api/proxy/ecommerce/returns/${returnId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: adminNote || null }),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(String(json?.message ?? 'Unable to update status.'))
    }

    await handleReturnUpdated()
  }

  const handleConfirmAction = async (adminNote: string) => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      await applyAction(confirmAction, adminNote)
      setConfirmAction(null)
    } finally {
      setActionLoading(false)
    }
  }

  const availableActions = (() => {
    switch (detail?.status) {
      case 'requested':
        return [
          { label: 'Approve', action: 'approve' },
          { label: 'Reject', action: 'reject' },
        ]
      case 'approved':
        return [{ label: 'Mark Received', action: 'mark_received' }]
      case 'in_transit':
        return [{ label: 'Mark Received', action: 'mark_received' }]
      case 'received':
        return [{ label: 'Mark Refunded', action: 'mark_refunded' }]
      default:
        return []
    }
  })()

  const handleActionClick = (action: string) => {
    if (action === 'mark_refunded') {
      setShowRefundModal(true)
      return
    }
    setConfirmAction(action)
  }

  const footerActionButtonClass = (action: string) => {
    const base = 'rounded px-4 py-2 text-sm text-white disabled:opacity-60'
    switch (action) {
      case 'approve':
        return `${base} bg-green-600 hover:bg-green-700`
      case 'reject':
        return `${base} bg-red-600 hover:bg-red-700`
      case 'mark_in_transit':
        return `${base} bg-blue-600 hover:bg-blue-700`
      case 'mark_received':
        return `${base} bg-teal-600 hover:bg-teal-700`
      case 'mark_refunded':
        return `${base} bg-orange-600 hover:bg-orange-700`
      default:
        return `${base} bg-slate-600 hover:bg-slate-700`
    }
  }

  const showRefundInfo = Boolean(
    detail &&
      (detail.refund_amount ||
        detail.refund_method ||
        detail.refund_proof_path ||
        detail.refund_proof_url ||
        detail.refunded_at ||
        detail.admin_note ||
        detail.refund?.receipt_public_url),
  )

  return (
    <>
      <div className={`fixed inset-0 ${zIndexClassName} flex h-[100dvh] max-h-[100dvh] bg-black/40`} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="hidden min-h-0 flex-1 bg-black/40 md:block" />
        <aside
          className="relative ml-auto flex h-full min-h-0 w-full max-w-4xl flex-col bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Return Details</h3>
              {detail?.order?.order_number ? (
                <p className="text-sm text-slate-500">Order No: {detail.order.order_number}</p>
              ) : null}
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
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading return details...</div>
            ) : error || !detail ? (
              <div className="py-8 text-center text-sm text-red-600">{error || 'Return not found'}</div>
            ) : (
              <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-5">
                <div className="w-full rounded border border-slate-200 bg-white lg:flex-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Basic Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <div className="mt-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStyle(normalizeStatus(detail.status))}`}>
                          {formatStatusLabel(detail.status)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Request Type</p>
                      <p className="font-medium text-slate-900">{detail.request_type ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Reason</p>
                      <p className="font-medium text-slate-900">{detail.reason ?? '—'}</p>
                      {detail.description && (
                        <p className="mt-1 text-xs text-slate-500">{detail.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full rounded border border-slate-200 bg-white lg:flex-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Customer Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="font-medium text-slate-900">{detail.customer?.name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium text-slate-900">{detail.customer?.email ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium text-slate-900">{detail.customer?.phone ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="w-full rounded border border-slate-200 bg-white lg:flex-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Timeline</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Requested</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.timeline?.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Reviewed</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.timeline?.reviewed_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Received</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.timeline?.received_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Refunded</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.timeline?.completed_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <div className="w-full rounded border border-slate-200 bg-white lg:w-[calc(50%-10px)]">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Return Items</p>
                  </div>
                  <div className="px-4 py-3">
                    {(detail.items ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500">No items</p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {(detail.items ?? []).map((item, idx) => {
                          const productName = item.product_name ?? item.product_name_snapshot ?? 'Item'
                          const quantity = item.quantity ?? item.requested_quantity ?? 0
                          const productImage = item.product_image ?? item.cover_image_url ?? null
                          const imageUrl = getImageUrl(productImage)
                          
                          return (
                            <div
                              key={item.product_id ?? item.order_item_id ?? idx}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
                            >
                              <div className="flex items-center gap-3">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={productName}
                                    className="h-12 w-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                                    <i className="fa-solid fa-image text-lg" />
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{productName}</p>
                                  {item.product_cn_name ? (
                                    <p className="text-xs text-slate-500">{item.product_cn_name}</p>
                                  ) : null}
                                  {(item.product_type === 'variant' || item.product_variant_id) && (
                                    <div className="text-xs text-slate-500">
                                      <p>Variant: {item.variant_name ?? '—'}</p>
                                      {item.variant_cn_name ? <p>{item.variant_cn_name}</p> : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-slate-600">
                                <p>Refund Qty: {quantity}</p>
                                {item.unit_price !== null && item.unit_price !== undefined && (
                                  <p className="text-xs text-slate-500">
                                    Unit: RM {formatAmount(item.unit_price)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {detail.initial_image_urls && detail.initial_image_urls.length > 0 && (
                  <div className="w-full rounded border border-slate-200 bg-white lg:w-[calc(50%-10px)]">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Submitted Media</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {detail.initial_image_urls.map((rawUrl) => {
                          const resolvedUrl = getFileUrl(rawUrl)
                          if (!resolvedUrl) return null
                          if (isEmbeddedVideoUrl(resolvedUrl)) {
                            return (
                              <div
                                key={resolvedUrl}
                                className="h-16 w-16 overflow-hidden rounded-md border border-slate-200"
                              >
                                <iframe
                                  src={resolvedUrl}
                                  title="Return video"
                                  className="h-full w-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )
                          }
                          if (isVideoUrl(resolvedUrl)) {
                            return (
                              <video
                                key={resolvedUrl}
                                src={resolvedUrl}
                                controls
                                className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                              />
                            )
                          }
                          return (
                            <a key={resolvedUrl} href={resolvedUrl} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolvedUrl}
                                alt="Return"
                                className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                              />
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-5">
                <div className="w-full rounded border border-slate-200 bg-white lg:flex-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Tracking Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Courier</p>
                      <p className="font-medium text-slate-900">{detail.return_courier_name ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tracking Number</p>
                      <p className="font-medium text-slate-900">{detail.return_tracking_no ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Shipped At</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.return_shipped_at)}</p>
                    </div>
                  </div>
                </div>

                {showRefundInfo ? (
                  <div className="w-full rounded border border-slate-200 bg-white lg:flex-1">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Refund Information</p>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      {detail.admin_note ? (
                        <div>
                          <p className="text-xs text-slate-500">Admin Note</p>
                          <p className="text-sm text-slate-900">{detail.admin_note}</p>
                        </div>
                      ) : null}
                      {detail.refund_amount ? (
                        <div>
                          <p className="text-xs text-slate-500">Amount</p>
                          <p className="font-medium text-slate-900">RM {formatAmount(detail.refund_amount)}</p>
                        </div>
                      ) : null}
                      {detail.refund_method ? (
                        <div>
                          <p className="text-xs text-slate-500">Method</p>
                          <p className="font-medium text-slate-900">{detail.refund_method}</p>
                        </div>
                      ) : null}
                      {detail.refunded_at ? (
                        <div>
                          <p className="text-xs text-slate-500">Refunded At</p>
                          <p className="font-medium text-slate-900">{formatDate(detail.refunded_at)}</p>
                        </div>
                      ) : null}
                      {refundProofUrl ? (
                        <div>
                          <p className="text-xs text-slate-500">Proof</p>
                          <a
                            href={refundProofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View refund proof
                          </a>
                        </div>
                      ) : null}
                      {detail.refund?.receipt_public_url ? (
                        <div>
                          <p className="text-xs text-slate-500">Refund Receipt</p>
                          <button
                            type="button"
                            onClick={() => setRefundReceipt({
                              url: detail.refund!.receipt_public_url!,
                              refundNo: detail.refund?.refund_no ?? undefined,
                            })}
                            className="text-sm font-semibold text-rose-700 hover:text-rose-900"
                          >
                            View refund receipt{detail.refund?.refund_no ? ` (${detail.refund.refund_no})` : ''}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
            )}
          </div>

          {!loading && detail && availableActions.length > 0 ? (
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-lg">
              <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                  <button
                    key={action.action}
                    type="button"
                    onClick={() => handleActionClick(action.action)}
                    disabled={actionLoading}
                    className={footerActionButtonClass(action.action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {confirmAction && detail ? (
        <ReturnActionConfirmModal
          action={confirmAction}
          orderNo={detail.order?.order_number}
          onClose={() => {
            if (!actionLoading) setConfirmAction(null)
          }}
          onConfirm={handleConfirmAction}
          zIndexClassName={nestedModalZIndexClassName}
        />
      ) : null}

      {showRefundModal && (
        <ReturnRefundModal
          returnId={returnId}
          onClose={() => setShowRefundModal(false)}
          onSuccess={async (payload) => {
            await handleReturnUpdated()
            setShowRefundModal(false)
            if (payload.receiptPublicUrl) {
              setRefundReceipt({
                url: payload.receiptPublicUrl,
                refundNo: payload.refundNo ?? undefined,
              })
            }
          }}
          zIndexClassName={nestedModalZIndexClassName}
        />
      )}

      {refundReceipt ? (
        <ReturnRefundReceiptModal
          receiptPublicUrl={refundReceipt.url}
          refundNo={refundReceipt.refundNo}
          onClose={() => setRefundReceipt(null)}
          zIndexClassName={nestedModalZIndexClassName}
        />
      ) : null}
    </>
  )
}

function ReturnRefundReceiptModal({
  receiptPublicUrl,
  refundNo,
  onClose,
  zIndexClassName,
}: {
  receiptPublicUrl: string
  refundNo?: string
  onClose: () => void
  zIndexClassName: string
}) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiptPublicUrl)}`

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-slate-950/50 p-4`}>
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-950">Refund Receipt</h3>
            {refundNo ? <p className="text-xs text-slate-500">{refundNo}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className="text-center text-sm font-semibold text-slate-700">Scan QR code to view receipt</p>
        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="Refund receipt QR code" className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2" />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(receiptPublicUrl)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={() => window.open(receiptPublicUrl, '_blank')}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
          >
            Open receipt
          </button>
        </div>
      </div>
    </div>
  )
}

function ReturnRefundModal({
  returnId,
  onClose,
  onSuccess,
  zIndexClassName = 'z-[60]',
}: {
  returnId: number
  onClose: () => void
  onSuccess: (payload: { receiptPublicUrl: string | null; refundNo?: string | null }) => void | Promise<void>
  zIndexClassName?: string
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState<ReturnRefundMethod>('cash')
  const [refundProof, setRefundProof] = useState<File | null>(null)
  const [refundProofPreview, setRefundProofPreview] = useState<string | null>(null)
  const refundProofInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!refundProof) {
      setRefundProofPreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(refundProof)
    setRefundProofPreview(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [refundProof])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!adminNote.trim()) {
      setError('Admin note is required')
      return
    }

    if (!refundAmount || Number(refundAmount) <= 0) {
      setError('Refund amount is required')
      return
    }

    if (!refundMethod) {
      setError('Refund method is required')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('action', 'mark_refunded')
      formData.append('admin_note', adminNote.trim())
      formData.append('refund_amount', refundAmount)
      formData.append('refund_method', refundMethod)
      if (refundProof) {
        formData.append('refund_proof_path', refundProof)
      }

      formData.append('_method', 'PUT')

      const res = await fetch(`/api/proxy/ecommerce/returns/${returnId}/status`, {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.message ?? 'Unable to update refund.')
        return
      }

      const refund = json?.data?.refund as { receipt_public_url?: string | null; refund_no?: string | null } | undefined
      await onSuccess({
        receiptPublicUrl: refund?.receipt_public_url ?? null,
        refundNo: refund?.refund_no ?? null,
      })
    } catch (err) {
      setError('Unable to update refund.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4`}>
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Refund Return</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="refundAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Refund Amount (RM) <span className="text-red-500">*</span>
            </label>
            <input
              id="refundAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <p className="mb-2 block text-sm font-medium text-gray-700">
              Refund Method <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {RETURN_REFUND_METHODS.map(({ method, label }) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setRefundMethod(method)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                    refundMethod === method
                      ? 'border-rose-500 bg-rose-50 text-rose-800'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="adminNote" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Note <span className="text-red-500">*</span>
            </label>
            <textarea
              id="adminNote"
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              rows={4}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter refund notes..."
            />
          </div>

          <div>
            <label htmlFor="refundProof" className="block text-sm font-medium text-gray-700 mb-1">
              Refund Proof (Optional)
            </label>
            <input
              ref={refundProofInputRef}
              id="refundProof"
              type="file"
              accept={IMAGE_PDF_ACCEPT}
              onChange={(event) => setRefundProof(event.target.files?.[0] || null)}
              className="hidden"
            />
            <div className="grid grid-cols-1 gap-3">
              <div
                className={`relative aspect-square w-36 rounded-xl border-2 border-dashed transition-all duration-200 ${
                  refundProof
                    ? 'border-gray-200 bg-white shadow-md hover:shadow-lg'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md cursor-pointer'
                }`}
                onClick={() => {
                  if (!refundProof) {
                    refundProofInputRef.current?.click()
                  }
                }}
              >
                {refundProof ? (
                  refundProof.type.startsWith('image/') && refundProofPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={refundProofPreview}
                      alt="Refund proof"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-gray-500">
                      <i className="fa-solid fa-file text-lg text-gray-400" />
                      <span className="line-clamp-2">{refundProof.name}</span>
                    </div>
                  )
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-gray-500">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <i className="fa-solid fa-cloud-arrow-up text-gray-400 text-lg" />
                    </div>
                    <span>Click to upload</span>
                  </div>
                )}
                {refundProof && (
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow hover:bg-white"
                      onClick={(event) => {
                        event.stopPropagation()
                        refundProofInputRef.current?.click()
                      }}
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-red-600 shadow hover:bg-white"
                      onClick={(event) => {
                        event.stopPropagation()
                        setRefundProof(null)
                        if (refundProofInputRef.current) {
                          refundProofInputRef.current.value = ''
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Process Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
