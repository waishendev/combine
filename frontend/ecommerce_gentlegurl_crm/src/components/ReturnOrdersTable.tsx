'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

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
  refunded_at?: string | null
  items?: ReturnItem[]
  timeline?: {
    created_at?: string | null
    reviewed_at?: string | null
    received_at?: string | null
    completed_at?: string | null
  }
}

type ReturnRow = {
  id: number
  orderNumber: string
  customer: string
  status: string
  reason: string
  createdAt: string
}

const statusOptions = ['requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'cancelled'] as const

const badgeStyle = (status: string) => {
  switch (status) {
    case 'requested':
      return 'bg-amber-50 text-amber-700'
    case 'approved':
      return 'bg-blue-50 text-blue-700'
    case 'in_transit':
      return 'bg-purple-50 text-purple-700'
    case 'received':
      return 'bg-emerald-50 text-emerald-700'
    case 'refunded':
      return 'bg-green-50 text-green-700'
    case 'rejected':
      return 'bg-rose-50 text-rose-700'
    case 'cancelled':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-700'
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

export default function ReturnOrdersTable() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState({ search: '', status: '' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionNote, setActionNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (search) {
      params.set('order_no', search)
      params.set('customer_name', search)
      params.set('customer_email', search)
    }
    return params.toString()
  }, [statusFilter, search])

  const fetchReturns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/ecommerce/returns?${queryString}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        setRows([])
        setError('Unable to load return requests.')
        return
      }

      const json = await res.json().catch(() => null)
      const payload = json?.data
      const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []

      const mapped = items.map((item: ReturnDetail & { created_at?: string | null }) => ({
        id: Number(item.id),
        orderNumber: item.order?.order_number ?? String(item.order?.id ?? '—'),
        customer: item.customer?.name ?? '—',
        status: item.status ?? '—',
        reason: item.reason ?? '—',
        createdAt: item.created_at ?? item.timeline?.created_at ?? item.timeline?.reviewed_at ?? '—',
      }))

      setRows(mapped)
      if (selectedId && !mapped.find((row) => row.id === selectedId)) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err) {
      setRows([])
      setError('Unable to load return requests.')
    } finally {
      setLoading(false)
    }
  }, [queryString, selectedId])

  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setDetail(null)
    setActionNote('')
    setActionError(null)
    setShowRefundModal(false)

    try {
      const res = await fetch(`/api/proxy/ecommerce/returns/${id}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setDetail(null)
        return
      }
      const json = await res.json().catch(() => null)
      setDetail(json?.data ?? null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
    }
  }, [selectedId, fetchDetail])

  const applyAction = async (action: string) => {
    if (!selectedId) return
    setActionError(null)

    if ((action === 'reject' || action === 'mark_refunded') && !actionNote.trim()) {
      setActionError('Admin note is required for this action.')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/returns/${selectedId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_note: actionNote }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setActionError(json?.message ?? 'Unable to update status.')
        return
      }

      await fetchReturns()
      await fetchDetail(selectedId)
      setActionNote('')
    } finally {
      setActionLoading(false)
    }
  }

  const availableActions = useMemo(() => {
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
  }, [detail?.status])

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: 'search' | 'status'; label: string; value: string }> = []
    if (search) {
      filters.push({ key: 'search', label: 'Search', value: search })
    }
    if (statusFilter) {
      filters.push({ key: 'status', label: 'Status', value: statusFilter })
    }
    return filters
  }, [search, statusFilter])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Return Orders</h3>
            <p className="text-sm text-gray-500">Manage return requests and track progress.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterDraft({ search, status: statusFilter })
                setIsFilterOpen(true)
              }}
              className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              <i className="fa-solid fa-filter" />
              Filter
            </button>
            <button
              type="button"
              onClick={fetchReturns}
              className="flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-arrow-rotate-right'}`} />
              Refresh
            </button>
          </div>
        </div>
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Total Requests
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm">
                {rows.length}
              </span>
            </span>
            {activeFilters.length === 0 && <span>No active filters</span>}
          </div>
          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <span
                  key={filter.key}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
                >
                  <span className="font-semibold">{filter.label}</span>
                  <span>{filter.value}</span>
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => {
                      if (filter.key === 'search') {
                        setSearch('')
                      } else {
                        setStatusFilter('')
                      }
                    }}
                    aria-label={`Remove ${filter.label} filter`}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Return ID</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoadingRow colSpan={6} />
              ) : error ? (
                <TableEmptyState colSpan={6} message={error} />
              ) : rows.length === 0 ? (
                <TableEmptyState colSpan={6} message="No return orders found." />
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer text-gray-700 transition hover:bg-gray-50 ${
                      selectedId === row.id ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{row.id}</td>
                    <td className="px-4 py-3">{row.orderNumber}</td>
                    <td className="px-4 py-3">{row.customer}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStyle(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.reason}</td>
                    <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        {!selectedId ? (
          <div className="text-sm text-gray-500">Select a return to view details.</div>
        ) : detailLoading ? (
          <div className="text-sm text-gray-500">Loading details...</div>
        ) : !detail ? (
          <div className="text-sm text-gray-500">Unable to load return details.</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="text-base font-semibold text-gray-800">Return #{detail.id}</h4>
              <p className="text-gray-500">Order {detail.order?.order_number ?? '—'}</p>
              <span className={`mt-2 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStyle(detail.status ?? '')}`}>
                {detail.status ?? '—'}
              </span>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Customer</p>
              <p>{detail.customer?.name ?? '—'}</p>
              <p className="text-gray-500">{detail.customer?.email ?? '—'}</p>
              <p className="text-gray-500">{detail.customer?.phone ?? '—'}</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Reason</p>
              <p>{detail.reason ?? '—'}</p>
              <p className="text-gray-500">{detail.description ?? '—'}</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Items</p>
              <div className="space-y-2">
                {(detail.items ?? []).map((item) => (
                  <div key={item.order_item_id} className="rounded-md border border-gray-200 px-3 py-2">
                    <p className="font-medium text-gray-800">{item.product_name_snapshot ?? 'Item'}</p>
                    <p className="text-xs text-gray-500">SKU: {item.sku_snapshot ?? '—'}</p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.requested_quantity ?? item.quantity ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {detail.initial_image_urls && detail.initial_image_urls.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-gray-700">Images</p>
                <div className="flex flex-wrap gap-2">
                  {detail.initial_image_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Return" className="h-16 w-16 rounded-md border border-gray-200 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Tracking</p>
              <p>Courier: {detail.return_courier_name ?? '—'}</p>
              <p>Tracking: {detail.return_tracking_no ?? '—'}</p>
              <p>Shipped: {formatDate(detail.return_shipped_at)}</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Admin Note</p>
              <p>{detail.admin_note ?? '—'}</p>
            </div>

            <div className="space-y-1">
              <p className="font-medium text-gray-700">Timeline</p>
              <p>Requested: {formatDate(detail.timeline?.created_at)}</p>
              <p>Reviewed: {formatDate(detail.timeline?.reviewed_at)}</p>
              <p>Received: {formatDate(detail.timeline?.received_at)}</p>
              <p>Refunded: {formatDate(detail.timeline?.completed_at)}</p>
            </div>

            {(detail.refund_amount ||
              detail.refund_method ||
              detail.refund_proof_path ||
              detail.refunded_at) && (
              <div className="space-y-1">
                <p className="font-medium text-gray-700">Refund</p>
                <p>Amount: RM {formatAmount(detail.refund_amount)}</p>
                <p>Method: {detail.refund_method ?? '—'}</p>
                <p>Refunded At: {formatDate(detail.refunded_at)}</p>
                {detail.refund_proof_path && (
                  <a
                    href={getFileUrl(detail.refund_proof_path) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View refund proof
                  </a>
                )}
              </div>
            )}

            {availableActions.length > 0 && (
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="text-xs font-semibold uppercase text-gray-500">Actions</label>
                <textarea
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  placeholder="Add admin note (required for rejection/refund)"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                  rows={3}
                />
                {actionError && <p className="text-sm text-rose-600">{actionError}</p>}
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
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showRefundModal && selectedId && (
        <ReturnRefundModal
          returnId={selectedId}
          onClose={() => setShowRefundModal(false)}
          onSuccess={async () => {
            await fetchReturns()
            await fetchDetail(selectedId)
            setShowRefundModal(false)
          }}
        />
      )}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsFilterOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Filter Returns</h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close filter"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                  Search
                </label>
                <input
                  value={filterDraft.search}
                  onChange={(event) => setFilterDraft((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Order number, customer name/email"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                  Status
                </label>
                <select
                  value={filterDraft.status}
                  onChange={(event) => setFilterDraft((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">All status</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                  setFilterDraft({ search: '', status: '' })
                  setIsFilterOpen(false)
                }}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch(filterDraft.search.trim())
                  setStatusFilter(filterDraft.status)
                  setIsFilterOpen(false)
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('action', 'mark_refunded')
      formData.append('admin_note', adminNote.trim())
      formData.append('refund_amount', refundAmount)
      if (refundMethod) {
        formData.append('refund_method', refundMethod)
      }
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg">
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
              Refund Method (Optional)
            </label>
            <select
              id="refundMethod"
              value={refundMethod}
              onChange={(event) => setRefundMethod(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select method</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="card_refund">Card Refund</option>
              <option value="store_credit">Store Credit</option>
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
              id="refundProof"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setRefundProof(event.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
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
