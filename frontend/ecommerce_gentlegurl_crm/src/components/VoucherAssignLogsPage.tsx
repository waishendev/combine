'use client'

import { useEffect, useMemo, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import type { AdminApiItem } from './adminUtils'

type VoucherAssignLogRow = {
  id: number
  assigned_at: string | null
  admin_id: number | null
  admin_name: string | null
  customer_id: number
  customer_name: string | null
  customer_email: string | null
  voucher_id: number
  voucher_code: string | null
  voucher_name: string | null
  quantity: number
  start_at: string | null
  end_at: string | null
  note: string | null
}

type Pagination = {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type VoucherAssignLogResponse = {
  date_range?: {
    from?: string
    to?: string
  }
  rows?: VoucherAssignLogRow[]
  pagination?: Partial<Pagination>
}

type AdminOption = {
  id: number
  name: string
  email?: string | null
}

const DEFAULT_PAGE_SIZE = 20

const formatDateInput = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: formatDateInput(start),
    to: formatDateInput(end),
  }
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatValidity = (start?: string | null, end?: string | null) => {
  if (!start && !end) return '—'
  const startLabel = start ? formatDateTime(start) : '—'
  const endLabel = end ? formatDateTime(end) : '—'
  return `${startLabel} ~ ${endLabel}`
}

export default function VoucherAssignLogsPage() {
  const defaultRange = useMemo(() => getDefaultRange(), [])
  const [filters, setFilters] = useState({
    date_from: defaultRange.from,
    date_to: defaultRange.to,
    customer_query: '',
    voucher_query: '',
    admin_id: '',
  })
  const [draft, setDraft] = useState(filters)
  const [rows, setRows] = useState<VoucherAssignLogRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    per_page: DEFAULT_PAGE_SIZE,
    current_page: 1,
    last_page: 1,
  })
  const [loading, setLoading] = useState(true)
  const [admins, setAdmins] = useState<AdminOption[]>([])
  const [adminsLoading, setAdminsLoading] = useState(false)

  const currentPage = pagination.current_page
  const totalPages = pagination.last_page

  useEffect(() => {
    setDraft(filters)
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    const fetchAdmins = async () => {
      setAdminsLoading(true)
      try {
        const res = await fetch('/api/proxy/admins?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) return

        const response = await res.json().catch(() => ({}))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let adminItems: AdminApiItem[] = []
        if (response?.data) {
          if (Array.isArray(response.data)) {
            adminItems = response.data
          } else if (
            typeof response.data === 'object' &&
            'data' in response.data &&
            Array.isArray(response.data.data)
          ) {
            adminItems = response.data.data
          }
        }

        const options = adminItems
          .map((item) => {
            const parsedId = typeof item.id === 'number' ? item.id : Number(item.id)
            if (!Number.isFinite(parsedId)) return null
            return {
              id: parsedId,
              name: item.username ?? item.email ?? `Admin ${parsedId}`,
              email: item.email ?? null,
            }
          })
          .filter(Boolean) as AdminOption[]

        setAdmins(options)
      } finally {
        if (!controller.signal.aborted) {
          setAdminsLoading(false)
        }
      }
    }

    fetchAdmins().catch(() => {
      if (!controller.signal.aborted) {
        setAdminsLoading(false)
      }
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const fetchLogs = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pagination.per_page))
        qs.set('date_from', filters.date_from)
        qs.set('date_to', filters.date_to)
        if (filters.customer_query) qs.set('customer_query', filters.customer_query)
        if (filters.voucher_query) qs.set('voucher_query', filters.voucher_query)
        if (filters.admin_id) qs.set('admin_id', filters.admin_id)

        const res = await fetch(`/api/proxy/ecommerce/vouchers/assign-logs?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setPagination((prev) => ({
            ...prev,
            total: 0,
            last_page: 1,
            current_page: 1,
          }))
          return
        }

        const response = await res.json().catch(() => ({}))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        const payload: VoucherAssignLogResponse = response?.data ?? {}
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
        setLoading(false)
      }
    })

    return () => controller.abort()
  }, [currentPage, filters, pagination.per_page])

  const handleApply = () => {
    setPagination((prev) => ({ ...prev, current_page: 1 }))
    setFilters(draft)
  }

  const handleReset = () => {
    const nextFilters = {
      date_from: defaultRange.from,
      date_to: defaultRange.to,
      customer_query: '',
      voucher_query: '',
      admin_id: '',
    }
    setPagination((prev) => ({ ...prev, current_page: 1 }))
    setFilters(nextFilters)
    setDraft(nextFilters)
  }

  const handleCopy = async (value: string | null | undefined) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch (error) {
      void error
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Date From</label>
            <input
              type="date"
              className="w-full mt-1 rounded border border-slate-200 px-3 py-2 text-sm"
              value={draft.date_from}
              onChange={(event) => setDraft((prev) => ({ ...prev, date_from: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Date To</label>
            <input
              type="date"
              className="w-full mt-1 rounded border border-slate-200 px-3 py-2 text-sm"
              value={draft.date_to}
              onChange={(event) => setDraft((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="text-xs font-semibold text-slate-500">Customer</label>
          <input
            type="text"
            className="w-full mt-1 rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search name or email"
            value={draft.customer_query}
            onChange={(event) => setDraft((prev) => ({ ...prev, customer_query: event.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Voucher</label>
          <input
            type="text"
            className="w-full mt-1 rounded border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search voucher code"
            value={draft.voucher_query}
            onChange={(event) => setDraft((prev) => ({ ...prev, voucher_query: event.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Admin</label>
          <select
            className="w-full mt-1 rounded border border-slate-200 px-3 py-2 text-sm"
            value={draft.admin_id}
            onChange={(event) => setDraft((prev) => ({ ...prev, admin_id: event.target.value }))}
          >
            <option value="">{adminsLoading ? 'Loading admins...' : 'All admins'}</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}{admin.email ? ` (${admin.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm border border-slate-200">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 border border-slate-200 text-left">DateTime</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Admin</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Customer</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Voucher</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Qty</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Validity</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Note</th>
              <th className="px-4 py-3 border border-slate-200 text-left">Copy</th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableLoadingRow colSpan={8} />}
            {!loading && rows.length === 0 && (
              <TableEmptyState message="No voucher assignment logs found." colSpan={8} />
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="border border-slate-200">
                  <td className="px-4 py-3 border border-slate-200 whitespace-nowrap">
                    {formatDateTime(row.assigned_at)}
                  </td>
                  <td className="px-4 py-3 border border-slate-200">
                    {row.admin_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 border border-slate-200">
                    <div className="font-medium text-slate-900">{row.customer_name ?? '—'}</div>
                    <div className="text-xs text-slate-500">{row.customer_email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 border border-slate-200">
                    <div className="font-medium text-slate-900">{row.voucher_code ?? '—'}</div>
                    <div className="text-xs text-slate-500">{row.voucher_name ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 border border-slate-200">{row.quantity}</td>
                  <td className="px-4 py-3 border border-slate-200">
                    {formatValidity(row.start_at, row.end_at)}
                  </td>
                  <td className="px-4 py-3 border border-slate-200">
                    {row.note || '—'}
                  </td>
                  <td className="px-4 py-3 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                        title="Copy voucher code"
                        onClick={() => handleCopy(row.voucher_code)}
                      >
                        <i className="fa-regular fa-copy" />
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                        title="Copy customer email"
                        onClick={() => handleCopy(row.customer_email)}
                      >
                        <i className="fa-regular fa-copy" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pagination.per_page}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, current_page: page }))}
        disabled={loading}
      />
    </div>
  )
}
