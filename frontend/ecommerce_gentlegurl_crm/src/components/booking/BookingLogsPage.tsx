'use client'

import { useEffect, useMemo, useState } from 'react'
import BookingLogsFiltersWrapper from './BookingLogsFiltersWrapper'
import {
  BookingLogsFilterValues,
  emptyBookingLogsFilters,
} from './BookingLogsFilters'
import BookingLogDetailsDrawer from './BookingLogDetailsDrawer'
import PaginationControls from '../PaginationControls'
import TableLoadingRow from '../TableLoadingRow'
import TableEmptyState from '../TableEmptyState'
import { useI18n } from '@/lib/i18n'

type LogRow = {
  id: number
  booking_id: number | null
  actor_type: string
  actor_name: string | null
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BookingLogApiResponse = {
  data?: LogRow[] | {
    current_page?: number
    data?: LogRow[]
    last_page?: number
    per_page?: number
    total?: number
    from?: number
    to?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

export default function BookingLogsPage() {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<BookingLogsFilterValues>({ ...emptyBookingLogsFilters })
  const [filters, setFilters] = useState<BookingLogsFilterValues>({ ...emptyBookingLogsFilters })
  const [rows, setRows] = useState<LogRow[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewingLog, setViewingLog] = useState<LogRow | null>(null)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const buildQuery = () => {
    const qs = new URLSearchParams()
    qs.set('page', String(currentPage))
    qs.set('per_page', String(pageSize))
    if (filters.action) qs.set('action', filters.action)
    return qs
  }

  const load = async () => {
    setLoading(true)
    try {
      const qs = buildQuery()
      const res = await fetch(`/api/proxy/admin/booking/logs?${qs.toString()}`, { cache: 'no-store' })
      
      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: BookingLogApiResponse = await res.json().catch(() => ({} as BookingLogApiResponse))
      
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let logItems: LogRow[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          logItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: LogRow[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          logItems = Array.isArray(nestedData.data) ? nestedData.data : []
          paginationData = {
            current_page: nestedData.current_page,
            last_page: nestedData.last_page,
            per_page: nestedData.per_page,
            total: nestedData.total,
          }
        }
      }

      if (response?.meta) {
        paginationData = { ...paginationData, ...response.meta }
      }

      setRows(logItems)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? logItems.length) || logItems.length,
      })
    } catch (error) {
      console.error('Failed to load logs:', error)
      setRows([])
      setMeta((prev) => ({ ...prev, total: 0 }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, pageSize])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('GRANT')) {
      return 'bg-green-100 text-green-800'
    }
    if (action.includes('UPDATE') || action.includes('MODIFY')) {
      return 'bg-blue-100 text-blue-800'
    }
    if (action.includes('DELETE') || action.includes('REMOVE')) {
      return 'bg-red-100 text-red-800'
    }
    if (action.includes('CANCEL')) {
      return 'bg-orange-100 text-orange-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  const handleFilterChange = (values: BookingLogsFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: BookingLogsFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyBookingLogsFilters })
    setFilters({ ...emptyBookingLogsFilters })
  }

  const handleBadgeRemove = (field: keyof BookingLogsFilterValues) => {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const totalPages = meta.last_page || 1
  const colCount = 6

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof BookingLogsFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof BookingLogsFilterValues, string> = {
    action: 'Action',
  }

  return (
    <div className="space-y-6 p-6">
      {isFilterModalOpen && (
        <BookingLogsFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {viewingLog && (
        <BookingLogDetailsDrawer
          log={viewingLog}
          onClose={() => setViewingLog(null)}
        />
      )}

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Booking Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Track and monitor all booking-related activities</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <i className="fa-solid fa-list-check" />
          <span>{meta.total} {meta.total === 1 ? 'log entry' : 'log entries'}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
            type="button"
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>
          <button
            onClick={() => window.open(`/api/proxy/admin/booking/logs/export.csv?${buildQuery().toString()}`, '_blank')}
            disabled={loading || rows.length === 0}
            className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <i className="fa-solid fa-download" />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, value]) => (
            <span
              key={String(key)}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
            >
              <span className="font-medium">{filterLabels[key]}</span>
              <span>{value}</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleBadgeRemove(key)}
                aria-label={`Remove filter ${filterLabels[key]}`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-clock text-slate-500" />
                    <span>Time</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-calendar-check text-slate-500" />
                    <span>Booking ID</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-user text-slate-500" />
                    <span>Actor</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-user-circle text-slate-500" />
                    <span>Actor Name</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-bolt text-slate-500" />
                    <span>Action</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-info-circle text-slate-500" />
                    <span>Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableLoadingRow colSpan={colCount} />
              ) : rows.length === 0 ? (
                <TableEmptyState colSpan={colCount} />
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-50/50"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatDate(row.created_at)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {row.booking_id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          <i className="fa-solid fa-hashtag" />
                          {row.booking_id}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        <i className="fa-solid fa-user-tag" />
                        {row.actor_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {row.actor_name ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                          <i className="fa-solid fa-user-circle" />
                          {row.actor_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getActionBadgeColor(row.action)}`}>
                        <i className="fa-solid fa-circle text-[6px]" />
                        {row.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                          onClick={() => setViewingLog(row)}
                          aria-label="View log details"
                          title="View log details"
                        >
                          <i className="fa-solid fa-eye" />
                        </button>
                        {row.meta && Object.keys(row.meta).length > 0 && (
                          <span className="text-xs text-slate-500">
                            {Object.keys(row.meta).length} {Object.keys(row.meta).length === 1 ? 'field' : 'fields'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />
    </div>
  )
}
