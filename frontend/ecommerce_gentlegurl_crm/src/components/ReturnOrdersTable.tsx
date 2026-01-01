'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

export default function ReturnOrdersTable() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionNote, setActionNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Return Orders</h3>
            <p className="text-sm text-gray-500">Manage return requests and track progress.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order/customer"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchReturns}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
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

            {availableActions.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-400">Update Status</label>
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
                      onClick={() => applyAction(action.action)}
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
    </div>
  )
}
