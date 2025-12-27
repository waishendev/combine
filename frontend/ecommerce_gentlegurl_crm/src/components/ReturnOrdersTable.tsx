'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

interface ReturnsApiResponse {
  data?: unknown
  meta?: {
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
  success?: boolean
  message?: string
}

interface ReturnRow {
  id: string
  orderId: string
  customer: string
  status: string
  reason: string
  date: string
}

const fallbackValue = (value: unknown, fallback = '—') => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  return String(value)
}

const formatDate = (value: unknown) => {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    return fallbackValue(value)
  }
  return date.toLocaleString()
}

const extractItems = (response: ReturnsApiResponse): unknown[] => {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  if (typeof response.data === 'object' && response.data !== null && 'data' in response.data) {
    const nested = response.data as { data?: unknown }
    if (Array.isArray(nested.data)) return nested.data
  }
  return []
}

export default function ReturnOrdersTable() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchReturns = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/proxy/ecommerce/returns', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setTotal(null)
          setError('Unable to load return orders.')
          return
        }

        const response: ReturnsApiResponse = await res
          .json()
          .catch(() => ({} as ReturnsApiResponse))

        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        const items = extractItems(response)
        const mappedRows = items.map((item) => {
          const record = item as Record<string, unknown>
          const customer =
            (record.customer && typeof record.customer === 'object' && (record.customer as { name?: string }).name) ||
            record.customer_name ||
            record.customer ||
            record.user_name ||
            record.user

          return {
            id: fallbackValue(record.id ?? record.return_id ?? record.request_id),
            orderId: fallbackValue(record.order_id ?? record.orderId ?? record.order_number ?? record.orderNumber),
            customer: fallbackValue(customer),
            status: fallbackValue(record.status ?? record.return_status),
            reason: fallbackValue(record.reason ?? record.return_reason ?? record.notes),
            date: formatDate(record.created_at ?? record.createdAt ?? record.requested_at ?? record.date),
          }
        })

        setRows(mappedRows)

        if (response?.meta?.total !== undefined) {
          setTotal(response.meta.total ?? null)
        } else if (
          response?.data &&
          typeof response.data === 'object' &&
          response.data !== null &&
          'total' in response.data
        ) {
          const nestedTotal = (response.data as { total?: number }).total
          setTotal(nestedTotal ?? null)
        } else {
          setTotal(mappedRows.length)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setRows([])
        setTotal(null)
        setError('Unable to load return orders.')
      } finally {
        setLoading(false)
      }
    }

    fetchReturns()

    return () => controller.abort()
  }, [])

  const colCount = 6

  const summary = useMemo(() => {
    if (total === null) return null
    return `${total} return${total === 1 ? '' : 's'}`
  }, [total])

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Return Orders</h3>
          {summary && <p className="text-sm text-gray-500">{summary}</p>}
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
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : error ? (
              <TableEmptyState colSpan={colCount} message={error} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={colCount} message="No return orders found." />
            ) : (
              rows.map((row) => (
                <tr key={`${row.id}-${row.orderId}`} className="text-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.id}</td>
                  <td className="px-4 py-3">{row.orderId}</td>
                  <td className="px-4 py-3">{row.customer}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.reason}</td>
                  <td className="px-4 py-3">{row.date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
