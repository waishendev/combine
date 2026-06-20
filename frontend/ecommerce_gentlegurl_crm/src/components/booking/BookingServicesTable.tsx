'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import BookingServiceFiltersWrapper from './BookingServiceFiltersWrapper'
import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import PaginationControls from '../PaginationControls'
import BookingServiceRow, { BookingServiceRowData } from './BookingServiceRow'
import {
  type BookingServiceCategoryOption,
  BOOKING_SERVICE_CATEGORY_FILTER_NONE,
  BookingServiceFilterValues,
  emptyBookingServiceFilters,
} from './BookingServiceFilters'
import BookingServiceCreateModal from './BookingServiceCreateModal'
import BookingServiceEditModal from './BookingServiceEditModal'
import BookingServiceDeleteModal from './BookingServiceDeleteModal'
import BookingServiceAllowedStaffPanel from './BookingServiceAllowedStaffPanel'
import BookingServiceBulkUpdateModal from './BookingServiceBulkUpdateModal'
import {
  type BookingServiceApiItem,
  mapBookingServiceApiItemToRow,
} from './bookingServiceUtils'
import CrmFormModalShell from '@/components/CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import { getApiErrorMessage } from '@/lib/api-errors'

interface BookingServicesTableProps {
  permissions: string[]
}

type ImportFailedRow = {
  row: number
  reason: string
}

type ImportSummary = {
  totalRows: number
  created: number
  updated?: number
  skipped: number
  failed: number
  failedRows?: ImportFailedRow[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type BookingServiceApiResponse = {
  data?: BookingServiceApiItem[] | {
    current_page?: number
    data?: BookingServiceApiItem[]
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

export default function BookingServicesTable({
  permissions,
}: BookingServicesTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createCopyFromServiceId, setCreateCopyFromServiceId] = useState<number | null>(null)
  const [inputs, setInputs] = useState<BookingServiceFilterValues>({ ...emptyBookingServiceFilters })
  const [filters, setFilters] = useState<BookingServiceFilterValues>({ ...emptyBookingServiceFilters })
  const [rows, setRows] = useState<BookingServiceRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof BookingServiceRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false)
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BookingServiceRowData | null>(null)
  const [viewingAllowedStaffService, setViewingAllowedStaffService] =
    useState<BookingServiceRowData | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<ImportFailedRow[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canCreate = permissions.includes('booking.services.create')
  const canUpdate = permissions.includes('booking.services.update')
  const canDelete = permissions.includes('booking.services.delete')
  const canViewAllowedStaff = permissions.includes('booking.services.view')
  const showActions = canUpdate || canDelete || canCreate
  const showSelection = canUpdate

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<BookingServiceCategoryOption[]>([])

  function DualSortIcons({
    active,
    dir,
    className = 'ml-1',
  }: {
    active: boolean
    dir: 'asc' | 'desc' | null
    className?: string
  }) {
    const activeColor = '#122350ff'
    const inactiveColor = '#afb2b8ff'
    const up = active && dir === 'asc' ? activeColor : inactiveColor
    const down = active && dir === 'desc' ? activeColor : inactiveColor

    return (
      <svg
        className={`${className} inline-block align-middle`}
        width="15"
        height="15"
        viewBox="0 0 10 12"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 1 L9 5 H1 Z" fill={up} />
        <path d="M5 11 L1 7 H9 Z" fill={down} />
      </svg>
    )
  }

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/proxy/admin/booking/categories?all=1', {
        cache: 'no-store',
        signal,
      })
      if (!res.ok) {
        setCategories([])
        return
      }
      const json = await res.json().catch(() => null)
      const payload = json?.data ?? json
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      setCategories(
        list
          .map((item: { id?: number | string; name?: string | null; cn_name?: string | null }) => ({
            id: Number(item?.id) || 0,
            name: String(item?.name ?? '').trim(),
            cnName: typeof item?.cn_name === 'string' ? item.cn_name.trim() : '',
          }))
          .filter((item: BookingServiceCategoryOption) => item.id > 0 && item.name),
      )
    } catch {
      setCategories([])
    }
  }, [])

  const fetchServices = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      if (filters.name.trim()) qs.set('name', filters.name.trim())
      if (filters.isActive) {
        qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
      }
      if (filters.categoryId) qs.set('category_id', filters.categoryId)

      const res = await fetch(`/api/proxy/admin/booking/services?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: BookingServiceApiResponse = await res
        .json()
        .catch(() => ({} as BookingServiceApiResponse))
      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let serviceItems: BookingServiceApiItem[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          serviceItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: BookingServiceApiItem[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          serviceItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      const list: BookingServiceRowData[] = serviceItems.map((item) => mapBookingServiceApiItemToRow(item))

      setRows(list)
      
      // If API doesn't return pagination data, calculate it from the list
      const totalItems = list.length
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
        setMeta((prev) => ({ ...prev, total: 0 }))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    void fetchCategories(controller.signal)
    return () => controller.abort()
  }, [fetchCategories])

  useEffect(() => {
    const controller = new AbortController()
    fetchServices(controller.signal)
    return () => controller.abort()
  }, [fetchServices])

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<number>()
      rows.forEach((row) => {
        if (prev.has(row.id)) next.add(row.id)
      })
      return next
    })
  }, [rows])

  const handleSort = (column: keyof BookingServiceRowData) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return rows

    const compare = (a: BookingServiceRowData, b: BookingServiceRowData) => {
      const valueA = a[sortColumn]
      const valueB = b[sortColumn]

      const normalize = (value: unknown) => {
        if (value == null) return ''
        if (typeof value === 'string') return value.toLowerCase()
        if (typeof value === 'number') return value
        if (typeof value === 'boolean') return value ? 1 : 0
        return value
      }

      const normalizedA = normalize(valueA)
      const normalizedB = normalize(valueB)

      if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
        return normalizedA - normalizedB
      }

      return String(normalizedA).localeCompare(String(normalizedB))
    }

    const sorted = [...rows].sort(compare)
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [rows, sortColumn, sortDirection])

  const handleFilterChange = (values: BookingServiceFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: BookingServiceFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyBookingServiceFilters })
    setFilters({ ...emptyBookingServiceFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof BookingServiceFilterValues) => {
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

  const colCount = 10 + (showActions ? 1 : 0) + (showSelection ? 1 : 0)

  const totalPages = meta.last_page || 1

  const visibleRowIds = useMemo(() => sortedRows.map((row) => row.id), [sortedRows])
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id))
  const hasSelection = selectedIds.size > 0

  const handleToggleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        visibleRowIds.forEach((id) => next.add(id))
      } else {
        visibleRowIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const handleToggleSelect = (service: BookingServiceRowData, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(service.id)
      else next.delete(service.id)
      return next
    })
  }

  const selectedServices = useMemo(() => {
    const selectedMap = new Set(selectedIds)
    return rows.filter((row) => selectedMap.has(row.id))
  }, [rows, selectedIds])

  const handleBulkDelete = () => {
    if (!selectedIds.size) return
    setBulkDeleteError(null)
    setIsBulkDeleteModalOpen(true)
  }

  const confirmBulkDelete = async () => {
    if (!selectedIds.size) return

    try {
      setIsBulkDeleting(true)
      const res = await fetch('/api/proxy/admin/booking/services/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setBulkDeleteError(getApiErrorMessage(json, 'Bulk delete failed.'))
        return
      }

      setSelectedIds(new Set())
      setIsBulkDeleteModalOpen(false)
      setBulkDeleteError(null)
      await fetchServices()
    } catch (error) {
      console.error(error)
      setBulkDeleteError(error instanceof Error ? error.message : 'Bulk delete failed.')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof BookingServiceFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof BookingServiceFilterValues, string> = {
    name: 'Name',
    isActive: t('common.status'),
    categoryId: 'Category',
  }

  const renderFilterValue = (key: keyof BookingServiceFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    if (key === 'categoryId') {
      if (value === BOOKING_SERVICE_CATEGORY_FILTER_NONE) {
        return 'No category'
      }
      const category = categories.find((item) => String(item.id) === value)
      return category?.name ?? value
    }
    return value
  }

  const handleServiceCreated = (service: BookingServiceRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== service.id)
      const next = [service, ...filtered]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = (prevMeta.total || 0) + 1
      const last_page = Math.max(
        prevMeta.last_page || 1,
        Math.ceil(total / perPage),
      )

      return {
        ...prevMeta,
        total,
        last_page,
      }
    })
  }

  const handleServiceUpdated = (service: BookingServiceRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === service.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = service
      return next
    })
  }

  const handleServiceDeleted = (serviceId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== serviceId))

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = Math.max((prevMeta.total || 0) - 1, 0)
      const last_page = Math.max(1, Math.ceil(total / perPage))
      const nextMeta: Meta = {
        ...prevMeta,
        total,
        last_page,
        current_page: Math.min(prevMeta.current_page || 1, last_page),
      }

      if ((prevMeta.current_page || 1) > last_page) {
        setCurrentPage(last_page)
      }

      return nextMeta
    })
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/services/export', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Export CSV failed.')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/) ?? null
      const fileName = fileNameMatch?.[1] ?? `booking-services-export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      window.alert('Export CSV failed. Please retry.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportCsvFile = async (file: File) => {
    setIsImporting(true)
    setImportSummary(null)
    setImportFailedRows([])
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/proxy/admin/booking/services/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Import CSV failed. Please retry.'
        throw new Error(message)
      }

      const summaryPayload =
        json && typeof json === 'object' && 'data' in json && json.data && typeof json.data === 'object'
          ? (json.data as ImportSummary)
          : null
      if (!summaryPayload) {
        throw new Error('Import summary is missing from API response.')
      }

      setImportSummary(summaryPayload)
      setImportFailedRows(Array.isArray(summaryPayload.failedRows) ? summaryPayload.failedRows : [])
      await fetchServices()
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Import CSV failed. Please retry.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div>
      {isBulkUpdateOpen && (
        <BookingServiceBulkUpdateModal
          show={isBulkUpdateOpen}
          selectedServices={selectedServices}
          onClose={() => setIsBulkUpdateOpen(false)}
          onSuccess={async () => {
            await fetchServices()
          }}
        />
      )}

      {isBulkDeleteModalOpen && (
        <CrmFormModalShell
          title="Delete Booking Services"
          onClose={() => {
            if (isBulkDeleting) return
            setIsBulkDeleteModalOpen(false)
            setBulkDeleteError(null)
          }}
          closeDisabled={isBulkDeleting}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  if (isBulkDeleting) return
                  setIsBulkDeleteModalOpen(false)
                  setBulkDeleteError(null)
                }}
                className="rounded border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="rounded bg-red-600 px-5 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                disabled={isBulkDeleting}
              >
                {isBulkDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          }
        >
          <div className="space-y-4 px-5 py-4">
            <p className="text-lg text-gray-700">
              Are you sure you want to delete {selectedIds.size} selected service(s)? This action cannot be undone.
            </p>
            <div className="max-h-52 overflow-auto rounded-lg bg-amber-100 px-4 py-3">
              {selectedServices.slice(0, 6).map((service) => (
                <div key={service.id} className="text-sm text-amber-900">
                  <p className="font-semibold">{service.name}</p>
                </div>
              ))}
              {selectedServices.length > 6 && (
                <p className="mt-2 text-xs text-amber-800">+{selectedServices.length - 6} more service(s)</p>
              )}
            </div>
            {bulkDeleteError ? (
              <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {bulkDeleteError}
              </div>
            ) : null}
          </div>
        </CrmFormModalShell>
      )}

      {isFilterModalOpen && (
        <BookingServiceFiltersWrapper
          inputs={inputs}
          categories={categories}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      {isCreateModalOpen && (
        <BookingServiceCreateModal
          key={createCopyFromServiceId ?? 'new'}
          copyFromServiceId={createCopyFromServiceId}
          onClose={() => {
            setCreateCopyFromServiceId(null)
            setIsCreateModalOpen(false)
          }}
          onSuccess={(service) => {
            setCreateCopyFromServiceId(null)
            setIsCreateModalOpen(false)
            handleServiceCreated(service)
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => {
                setCreateCopyFromServiceId(null)
                setIsCreateModalOpen(true)
              }}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </button>
          )}

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>

          {showSelection && (
            <>
              <button
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
                onClick={() => setIsBulkUpdateOpen(true)}
                disabled={!hasSelection}
                type="button"
              >
                <i className="fa-solid fa-pen-to-square" />
                Bulk Update
              </button>
              {canDelete && (
                <button
                  type="button"
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
                  onClick={handleBulkDelete}
                  disabled={!hasSelection}
                >
                  <i className="fa-solid fa-trash" />
                  Bulk Delete
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleImportCsvFile(file)
              }
            }}
          />
          <button
            type="button"
            className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={handleExportCsv}
            disabled={loading || isExporting || isImporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isExporting || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
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

      {(isImporting || importSummary) && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>Import status: processing file on server...</div>
          {importSummary && (
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
              <div>Total rows: {importSummary.totalRows}</div>
              <div>Created: {importSummary.created}</div>
              <div>Updated: {importSummary.updated ?? 0}</div>
              <div>Skipped: {importSummary.skipped}</div>
              <div>Failed: {importSummary.failed}</div>
            </div>
          )}
          {importFailedRows.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {importFailedRows.map((item, index) => (
                <div key={`${item.row}-${index}`}>Row {item.row}: {item.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}

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

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {showSelection && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleSelectAll(event.target.checked)}
                    aria-label="Select all services"
                  />
                </th>
              )}
              {(
                [
                  { key: 'imageUrl', label: 'Image' },
                  { key: 'name', label: 'Name' },
                  { key: 'serviceType', label: 'Type' },
                  { key: 'description', label: 'Description' },
                  { key: 'duration_min', label: 'Duration (min)' },
                  { key: 'service_price', label: 'Service Price' },
                  { key: 'deposit_amount', label: 'Deposit' },
                  { key: 'buffer_min', label: 'Buffer (min)' },
                  { key: 'allowedStaffCount', label: 'Allowed staff' },
                  { key: 'isActive', label: t('common.status') },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key as keyof BookingServiceRowData)}
                  >
                    <span>{label}</span>
                    <DualSortIcons
                      active={sortColumn === key && sortDirection !== null}
                      dir={sortColumn === key ? sortDirection : null}
                    />
                  </button>
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              sortedRows.map((service) => (
                <BookingServiceRow
                  key={service.id}
                  service={service}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canDuplicate={canCreate}
                  canViewAllowedStaff={canViewAllowedStaff}
                  showSelection={showSelection}
                  isSelected={selectedIds.has(service.id)}
                  onToggleSelect={handleToggleSelect}
                  onDuplicate={() => {
                    setCreateCopyFromServiceId(service.id)
                    setIsCreateModalOpen(true)
                  }}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingServiceId(service.id)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(service)
                    }
                  }}
                  onViewAllowedStaff={() => {
                    if (canViewAllowedStaff) {
                      setViewingAllowedStaffService(service)
                    }
                  }}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingServiceId !== null && (
        <BookingServiceEditModal
          key={editingServiceId}
          serviceId={editingServiceId}
          onClose={() => setEditingServiceId(null)}
          onSuccess={(service) => {
            setEditingServiceId(null)
            handleServiceUpdated(service)
          }}
        />
      )}

      {deleteTarget && (
        <BookingServiceDeleteModal
          service={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(serviceId) => {
            setDeleteTarget(null)
            handleServiceDeleted(serviceId)
          }}
        />
      )}

      {viewingAllowedStaffService && (
        <BookingServiceAllowedStaffPanel
          service={viewingAllowedStaffService}
          onClose={() => setViewingAllowedStaffService(null)}
        />
      )}

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
