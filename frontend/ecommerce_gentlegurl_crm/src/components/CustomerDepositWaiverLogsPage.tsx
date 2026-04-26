'use client'

import { useEffect, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'

type DepositWaiverLogRow = {
  id: number
  created_at: string | null
  action_type: string | null
  before_value?: {
    allow_booking_without_deposit?: boolean
  } | null
  after_value?: {
    allow_booking_without_deposit?: boolean
  } | null
  remark: string | null
  customer?: {
    id?: number
    name?: string | null
    phone?: string | null
  } | null
  created_by?: {
    id?: number
    name?: string | null
  } | null
}

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type DepositWaiverLogResponse = {
  rows?: DepositWaiverLogRow[]
  pagination?: Partial<Pagination>
}

const DEFAULT_PAGE_SIZE = 20

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const parseDepositWaiverValue = (payload?: { allow_booking_without_deposit?: boolean } | null) => {
  if (!payload || typeof payload.allow_booking_without_deposit !== 'boolean') {
    return '—'
  }

  return payload.allow_booking_without_deposit ? 'Enabled' : 'Disabled'
}

const normalizeActionType = (value?: string | null) => {
  if (value === 'enable_deposit_waiver' || value === 'enable') return 'enable'
  if (value === 'disable_deposit_waiver' || value === 'disable') return 'disable'
  return value ?? '—'
}

export default function CustomerDepositWaiverLogsPage() {
  const [rows, setRows] = useState<DepositWaiverLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: DEFAULT_PAGE_SIZE,
    current_page: 1,
    last_page: 1,
  })

  const currentPage = pagination.current_page
  const totalPages = pagination.last_page

  useEffect(() => {
    const controller = new AbortController()

    const fetchLogs = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pagination.per_page))

        const res = await fetch(`/api/proxy/customer-deposit-waiver-logs?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          return
        }

        const response = await res.json().catch(() => ({}))

        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        const payload: DepositWaiverLogResponse = response?.data ?? {}
        setRows(Array.isArray(payload.rows) ? payload.rows : [])
        setPagination((prev) => ({
          total: Number(payload.pagination?.total ?? prev.total),
          per_page: Number(payload.pagination?.per_page ?? prev.per_page),
          current_page: Number(payload.pagination?.current_page ?? prev.current_page),
          last_page: Number(payload.pagination?.last_page ?? prev.last_page),
        }))
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchLogs().catch(() => {
      if (!controller.signal.aborted) {
        setRows([])
        setLoading(false)
      }
    })

    return () => controller.abort()
  }, [currentPage, pagination.per_page])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-4 py-3 border border-gray-200">Created At</th>
              <th className="px-4 py-3 border border-gray-200">Customer Name</th>
              <th className="px-4 py-3 border border-gray-200">Phone</th>
              <th className="px-4 py-3 border border-gray-200">Action Type</th>
              <th className="px-4 py-3 border border-gray-200">Before Value</th>
              <th className="px-4 py-3 border border-gray-200">After Value</th>
              <th className="px-4 py-3 border border-gray-200">Remark</th>
              <th className="px-4 py-3 border border-gray-200">Created By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableLoadingRow key={idx} colSpan={8} />
              ))
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={8} message="No deposit waiver logs found." />
            ) : (
              rows.map((row) => {
                const actionType = normalizeActionType(row.action_type)
                const actionTypeLabel = actionType === 'enable' || actionType === 'disable' ? actionType : '—'
                const actionTypeClass =
                  actionType === 'enable'
                    ? 'bg-green-100 text-green-700'
                    : actionType === 'disable'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'

                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 border border-gray-200">{row.customer?.name || '—'}</td>
                    <td className="px-4 py-3 border border-gray-200 whitespace-nowrap">{row.customer?.phone || '—'}</td>
                    <td className="px-4 py-3 border border-gray-200">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${actionTypeClass}`}>
                        {actionTypeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 border border-gray-200">{parseDepositWaiverValue(row.before_value)}</td>
                    <td className="px-4 py-3 border border-gray-200">{parseDepositWaiverValue(row.after_value)}</td>
                    <td className="px-4 py-3 border border-gray-200">{row.remark || '—'}</td>
                    <td className="px-4 py-3 border border-gray-200">{row.created_by?.name || 'System'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Total: {pagination.total}</div>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pagination.per_page}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, current_page: page }))}
          disabled={loading}
        />
      </div>
    </div>
  )
}
