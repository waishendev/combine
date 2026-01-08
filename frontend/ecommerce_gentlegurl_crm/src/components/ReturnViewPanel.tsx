'use client'

import { useEffect, useRef, useState, FormEvent } from 'react'

type ReturnItem = {
  order_item_id: number
  product_name_snapshot?: string | null
  sku_snapshot?: string | null
  requested_quantity?: number | null
  quantity?: number | null
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

export default function ReturnViewPanel({
  returnId,
  onClose,
  onReturnUpdated,
}: ReturnViewPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const refundProofUrl = detail
    ? getFileUrl(detail.refund_proof_url ?? detail.refund_proof_path)
    : null

  useEffect(() => {
    const controller = new AbortController()

    const fetchDetail = async () => {
      setLoading(true)
      setError(null)
      setActionNote('')
      setActionError(null)
      setShowRefundModal(false)

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
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Unable to load return details.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchDetail().catch(() => {
      setLoading(false)
      setError('Unable to load return details.')
    })

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

  const applyAction = async (action: string) => {
    if (!returnId) return
    setActionError(null)

    if ((action === 'reject' || action === 'mark_refunded') && !actionNote.trim()) {
      setActionError('Admin note is required for this action.')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/returns/${returnId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_note: actionNote }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setActionError(json?.message ?? 'Unable to update status.')
        return
      }

      await handleReturnUpdated()
      setActionNote('')
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
        return [
          { label: 'Mark In Transit', action: 'mark_in_transit' },
          { label: 'Mark Received', action: 'mark_received' },
        ]
      case 'in_transit':
        return [{ label: 'Mark Received', action: 'mark_received' }]
      case 'received':
        return [{ label: 'Mark Refunded', action: 'mark_refunded' }]
      default:
        return []
    }
  })()

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black/40">
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Return Details</h3>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
          </div>
        </aside>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black/40">
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Return Details</h3>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="py-8 text-center text-sm text-red-600">{error || 'Return not found'}</div>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="hidden flex-1 bg-black/40 md:block" />
        <aside
          className="relative ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Return #{detail.id}</h3>
              <p className="text-xs text-slate-500">Order {detail.order?.order_number ?? '—'}</p>
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
          <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
            <div className="space-y-5 text-sm">
              <div className="rounded border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Basic Information</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStyle(detail.status ?? '')}`}>
                        {detail.status ?? '—'}
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

              <div className="rounded border border-slate-200 bg-white">
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

              <div className="rounded border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Return Items</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {(detail.items ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500">No items</p>
                  ) : (
                    (detail.items ?? []).map((item) => (
                      <div key={item.order_item_id} className="rounded-md border border-slate-200 px-3 py-2">
                        <p className="font-medium text-slate-800">{item.product_name_snapshot ?? 'Item'}</p>
                        <p className="text-xs text-slate-500">SKU: {item.sku_snapshot ?? '—'}</p>
                        <p className="text-xs text-slate-500">
                          Qty: {item.requested_quantity ?? item.quantity ?? 0}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {detail.initial_image_urls && detail.initial_image_urls.length > 0 && (
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Submitted Media</p>
                  </div>
                  <div className="px-4 py-3">
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

              <div className="rounded border border-slate-200 bg-white">
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

              <div className="rounded border border-slate-200 bg-white">
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

              {detail.admin_note && (
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Admin Note</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-slate-900">{detail.admin_note}</p>
                  </div>
                </div>
              )}

              {(detail.refund_amount ||
                detail.refund_method ||
                detail.refund_proof_path ||
                detail.refund_proof_url ||
                detail.refunded_at) && (
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Refund Information</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Amount</p>
                      <p className="font-medium text-slate-900">RM {formatAmount(detail.refund_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Method</p>
                      <p className="font-medium text-slate-900">{detail.refund_method ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Refunded At</p>
                      <p className="font-medium text-slate-900">{formatDate(detail.refunded_at)}</p>
                    </div>
                    {refundProofUrl && (
                      <div>
                        <p className="text-xs text-slate-500">Proof</p>
                        <a
                          href={refundProofUrl ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View refund proof
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {availableActions.length > 0 && (
                <div className="rounded border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Actions</p>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-slate-700">
                        Admin Note {availableActions.some((a) => a.action === 'reject' || a.action === 'mark_refunded') && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={actionNote}
                        onChange={(event) => setActionNote(event.target.value)}
                        placeholder="Add admin note (required for rejection/refund)"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                        rows={3}
                      />
                      {actionError && <p className="mt-1 text-xs text-red-600">{actionError}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableActions.map((action) => (
                        <button
                          key={action.action}
                          type="button"
                          onClick={() => {
                            if (action.action === 'mark_refunded') {
                              setShowRefundModal(true)
                              return
                            }
                            applyAction(action.action)
                          }}
                          disabled={actionLoading}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showRefundModal && (
        <ReturnRefundModal
          returnId={returnId}
          onClose={() => setShowRefundModal(false)}
          onSuccess={async () => {
            await handleReturnUpdated()
            setShowRefundModal(false)
          }}
        />
      )}
    </>
  )
}

function ReturnRefundModal({
  returnId,
  onClose,
  onSuccess,
}: {
  returnId: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('')
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

      onSuccess()
    } catch (err) {
      setError('Unable to update refund.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
            <label htmlFor="refundMethod" className="block text-sm font-medium text-gray-700 mb-1">
              Refund Method <span className="text-red-500">*</span>
            </label>
            <select
              id="refundMethod"
              value={refundMethod}
              onChange={(event) => setRefundMethod(event.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select method</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
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
              accept="image/*,application/pdf"
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
