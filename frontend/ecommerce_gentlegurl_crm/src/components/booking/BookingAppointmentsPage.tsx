'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import PaginationControls from '@/components/PaginationControls'
import BookingAppointmentFiltersWrapper from './BookingAppointmentFiltersWrapper'
import BookingAppointmentDrawer from './BookingAppointmentDrawer'
import {
  BookingAppointmentFilterValues,
  emptyBookingAppointmentFilters,
} from './BookingAppointmentFilters'
import { useI18n } from '@/lib/i18n'
import StatusBadge from '@/components/StatusBadge'

type BookingRow = {
  id: number
  booking_code: string | null
  customer: { id: number; name: string; phone: string | null } | null
  service: { id: number; name: string } | null
  staff: { id: number; name: string } | null
  start_at: string
  end_at?: string | null
  status: string
  deposit_amount: string | number
  created_at: string
}

type StaffOption = { id: number; name: string }

type Props = {
  permissions: string[]
}

type StatusOption =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LATE_CANCELLATION'
  | 'NO_SHOW'
  | 'NOTIFIED_CANCELLATION'

const STATUS_OPTIONS: StatusOption[] = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'LATE_CANCELLATION',
  'NO_SHOW',
  'NOTIFIED_CANCELLATION',
]

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BookingAppointmentApiResponse = {
  data?: BookingRow[] | {
    current_page?: number
    data?: BookingRow[]
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

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const extractData = <T,>(payload: unknown, fallback: T): T => {
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T
  if (root.data && typeof root.data === 'object' && 'data' in (root.data as object)) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T
  }
  return fallback
}

export default function BookingAppointmentsPage({ permissions }: Props) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<BookingAppointmentFilterValues>({ ...emptyBookingAppointmentFilters })
  const [filters, setFilters] = useState<BookingAppointmentFilterValues>({ ...emptyBookingAppointmentFilters })
  const [rows, setRows] = useState<BookingRow[]>([])
  const [staffs, setStaffs] = useState<StaffOption[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<BookingRow | null>(null)
  const [nextStatus, setNextStatus] = useState<StatusOption>('CONFIRMED')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)

  const canUpdateStatus = permissions.includes('booking.appointments.update_status')

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const loadStaffs = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      const data = extractData<StaffOption[]>(json, [])
      setStaffs(data)
    } catch {
      setStaffs([])
    }
  }, [])

  const fetchAppointments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.date) qs.set('date', filters.date)
      if (filters.staffId) qs.set('staff_id', filters.staffId)
      if (filters.status) qs.set('status', filters.status)
      if (filters.search.trim()) qs.set('q', filters.search.trim())

      const res = await fetch(`/api/proxy/admin/booking/appointments?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setError('Failed to load appointments.')
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: BookingAppointmentApiResponse = await res
        .json()
        .catch(() => ({} as BookingAppointmentApiResponse))

      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let appointmentItems: BookingRow[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          appointmentItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: BookingRow[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          appointmentItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      setRows(appointmentItems)

      // If API doesn't return pagination data, calculate it from the list
      const totalItems = appointmentItems.length
      const calculatedLastPage = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1

      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? calculatedLastPage) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? totalItems) || totalItems,
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setRows([])
        setError('Failed to load appointments.')
        setMeta((prev) => ({ ...prev, total: 0 }))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters, pageSize])

  useEffect(() => {
    loadStaffs()
  }, [loadStaffs])

  useEffect(() => {
    const controller = new AbortController()
    fetchAppointments(controller.signal)
    return () => controller.abort()
  }, [fetchAppointments])

  const handleFilterChange = (values: BookingAppointmentFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: BookingAppointmentFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyBookingAppointmentFilters })
    setFilters({ ...emptyBookingAppointmentFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof BookingAppointmentFilterValues) => {
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

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof BookingAppointmentFilterValues, string][])
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof BookingAppointmentFilterValues, string> = {
    date: 'Date',
    staffId: 'Staff',
    status: 'Status',
    search: 'Search',
  }

  const renderFilterValue = (key: keyof BookingAppointmentFilterValues, value: string) => {
    if (key === 'staffId') {
      const staff = staffs.find((s) => String(s.id) === value)
      return staff ? staff.name : value
    }
    return value
  }

  const openStatusModal = (row: BookingRow) => {
    setStatusTarget(row)
    setNextStatus((STATUS_OPTIONS.includes(row.status as StatusOption) ? row.status : 'CONFIRMED') as StatusOption)
    setNotes('')
    setReason('')
    setStatusModalOpen(true)
  }

  const submitStatusUpdate = async () => {
    if (!statusTarget) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/appointments/${statusTarget.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, notes: notes || null, reason: reason || null }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string')
          ? json.message
          : 'Failed to update status.'
        setError(message)
        return
      }

      setStatusModalOpen(false)
      setStatusTarget(null)
      await fetchAppointments()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overflow-y-auto py-6 px-10 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Booking Appointments</h2>
          <p className="mt-1 text-sm text-slate-500">View appointments and update booking statuses.</p>
        </div>
      </div>

      <div>
        {isFilterModalOpen && (
          <BookingAppointmentFiltersWrapper
            inputs={inputs}
            onChange={handleFilterChange}
            onSubmit={handleFilterSubmit}
            onReset={handleFilterReset}
            onClose={() => setIsFilterModalOpen(false)}
            disabled={loading}
            staffs={staffs}
          />
        )}

        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
              onClick={() => setIsFilterModalOpen(true)}
              disabled={loading}
            >
              <i className="fa-solid fa-filter" />
              {t('common.filter')}
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

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {activeFilters.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
              >
                <span className="font-medium">{filterLabels[key]}</span>
                <span>{renderFilterValue(key, value)}</span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800"
                  onClick={() => handleBadgeRemove(key)}
                  aria-label={`${t('common.removeFilter')} ${filterLabels[key]}`}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">{error}</div>}

        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-slate-300/70">
              <tr>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Booking</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Customer</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Service</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Staff</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Time</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Status</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Deposit</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">Created</th>
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={9} />
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="text-sm">
                    <td className="px-4 py-2 border border-gray-200">{row.booking_code || `#${row.id}`}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      {row.customer?.name || '-'}
                      <div className="text-xs text-slate-500">{row.customer?.phone || '-'}</div>
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.service?.name || '-'}</td>
                    <td className="px-4 py-2 border border-gray-200">{row.staff?.name || '-'}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      {formatDateTime(row.start_at)} - {formatDateTime(row.end_at)}
                    </td>
                    <td className="px-4 py-2 border border-gray-200">
                      <StatusBadge status={row.status} label={row.status} />
                    </td>
                    <td className="px-4 py-2 border border-gray-200">{row.deposit_amount}</td>
                    <td className="px-4 py-2 border border-gray-200">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingId(row.id)
                            setDrawerOpen(true)
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                          aria-label="View details"
                          title="View details"
                        >
                          <i className="fa-solid fa-eye" />
                        </button>
                        {canUpdateStatus && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => openStatusModal(row)}
                            aria-label="Update status"
                            title="Update status"
                          >
                            <i className="fa-solid fa-arrows-rotate" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <TableEmptyState colSpan={9} />
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          disabled={loading}
        />
      </div>

      {statusModalOpen && statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Update Status: {statusTarget.booking_code || `#${statusTarget.id}`}</h3>
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as StatusOption)}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {nextStatus === 'NOTIFIED_CANCELLATION' && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Must be &gt;=24h and not NO_SHOW. Voucher will be auto-created if eligible.
                </p>
              )}
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notes (optional)"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setStatusModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={submitStatusUpdate}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingAppointmentDrawer
        bookingId={selectedBookingId}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedBookingId(null)
        }}
        permissions={permissions}
        onStatusUpdated={async () => {
          const controller = new AbortController()
          await fetchAppointments(controller.signal)
        }}
      />
    </div>
  )
}
