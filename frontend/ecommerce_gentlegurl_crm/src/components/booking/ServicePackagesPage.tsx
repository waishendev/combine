'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import PaginationControls from '../PaginationControls'
import TableEmptyState from '../TableEmptyState'
import TableLoadingRow from '../TableLoadingRow'
import ServicePackageDeleteModal from './ServicePackageDeleteModal'
import ServicePackageFormModal from './ServicePackageFormModal'
import type { ServicePackage } from './servicePackageTypes'
import { useI18n } from '@/lib/i18n'

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ServicePackageApiResponse = {
  data?: ServicePackage[] | {
    current_page?: number
    data?: ServicePackage[]
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

interface ServicePackagesPageProps {
  permissions?: string[]
}

export default function ServicePackagesPage({ permissions = [] }: ServicePackagesPageProps) {
  const { t } = useI18n()
  const [rows, setRows] = useState<ServicePackage[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null)
  const [deletingPackage, setDeletingPackage] = useState<ServicePackage | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<ImportFailedRow[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canCreate = permissions.includes('service-packages.create')
  const canUpdate = permissions.includes('service-packages.update')
  const canDelete = permissions.includes('service-packages.delete')
  const showActions = canUpdate || canDelete

  const fetchPackages = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))

      const res = await fetch(`/api/proxy/service-packages?${qs.toString()}`, {
        cache: 'no-store',
        signal,
      })

      if (!res.ok) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
        return
      }

      const response: ServicePackageApiResponse = await res
        .json()
        .catch(() => ({} as ServicePackageApiResponse))

      if (response?.success === false && response?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      let packageItems: ServicePackage[] = []
      let paginationData: Partial<Meta> = {}

      if (response?.data) {
        if (Array.isArray(response.data)) {
          packageItems = response.data
        } else if (typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = response.data as {
            data?: ServicePackage[]
            current_page?: number
            last_page?: number
            per_page?: number
            total?: number
          }
          packageItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

      setRows(packageItems)
      setMeta({
        current_page: Number(paginationData.current_page ?? currentPage) || 1,
        last_page: Number(paginationData.last_page ?? 1) || 1,
        per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
        total: Number(paginationData.total ?? packageItems.length) || packageItems.length,
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setRows([])
        setMeta((prev) => ({ ...prev, total: 0 }))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    fetchPackages(controller.signal)
    return () => controller.abort()
  }, [fetchPackages])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const refreshAfterModalAction = async () => {
    await fetchPackages()
    setCreateOpen(false)
    setEditingPackageId(null)
    setDeletingPackage(null)
  }

  const totalPages = meta.last_page || 1
  const colCount = showActions ? 6 : 5

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/proxy/service-packages/export', { cache: 'no-store' })
      if (!res.ok) {
        throw new Error('Export CSV failed.')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/) ?? null
      const fileName = fileNameMatch?.[1] ?? `booking-service-packages-export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
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

      const res = await fetch('/api/proxy/service-packages/import', {
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
      await fetchPackages()
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </button>
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
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
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

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                Name
              </th>
              <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                Description
              </th>
              <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                Price
              </th>
              <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                Valid Days
              </th>
              <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                Status
              </th>
              {showActions && (
                <th className="px-4 py-2 text-left font-semibold tracking-wider text-gray-600">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              rows.map((pkg) => (
                <tr key={pkg.id} className="text-sm">
                  <td className="border border-gray-200 px-4 py-2 font-medium text-gray-900">
                    {pkg.name}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {pkg.description || '-'}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    RM {Number(pkg.selling_price).toFixed(2)}
                  </td>
                  <td className="border border-gray-200 px-4 py-2 text-gray-700">
                    {pkg.valid_days ? `${pkg.valid_days}` : '-'}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      pkg.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pkg.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  {showActions && (
                    <td className="border border-gray-200 px-4 py-2">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => setEditingPackageId(pkg.id)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => setDeletingPackage(pkg)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
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

      {createOpen && (
        <ServicePackageFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSuccess={refreshAfterModalAction}
        />
      )}

      {editingPackageId && (
        <ServicePackageFormModal
          mode="edit"
          packageId={editingPackageId}
          onClose={() => setEditingPackageId(null)}
          onSuccess={refreshAfterModalAction}
        />
      )}

      {deletingPackage && (
        <ServicePackageDeleteModal
          servicePackage={deletingPackage}
          onClose={() => setDeletingPackage(null)}
          onDeleted={refreshAfterModalAction}
        />
      )}
    </div>
  )
}
