'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import AnnouncementRow, { AnnouncementRowData } from './AnnouncementRow'
import AnnouncementCreateModal from './AnnouncementCreateModal'
import AnnouncementEditModal from './AnnouncementEditModal'
import AnnouncementDeleteModal from './AnnouncementDeleteModal'
import {
  type AnnouncementApiItem,
  mapAnnouncementApiItemToRow,
} from './announcementUtils'
import { useI18n } from '@/lib/i18n'

interface AnnouncementTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type AnnouncementApiResponse = {
  data?: AnnouncementApiItem[] | {
    current_page?: number
    data?: AnnouncementApiItem[]
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

export default function AnnouncementTable({
  permissions,
}: AnnouncementTableProps) {
  const { t } = useI18n()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [rows, setRows] = useState<AnnouncementRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof AnnouncementRowData | null>(
    'title',
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    'asc',
  )
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRowData | null>(null)

  const canCreate = permissions.includes('ecommerce.announcements.create')
  const canUpdate = permissions.includes('ecommerce.announcements.update')
  const canDelete = permissions.includes('ecommerce.announcements.delete')
  const showActions = canUpdate || canDelete

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    const controller = new AbortController()
    const fetchAnnouncements = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))

        const res = await fetch(`/api/proxy/ecommerce/announcements?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: AnnouncementApiResponse = await res
          .json()
          .catch(() => ({} as AnnouncementApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let announcementItems: AnnouncementApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            announcementItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: AnnouncementApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            announcementItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        // Fallback to meta if available
        if (response?.meta) {
          paginationData = { ...paginationData, ...response.meta }
        }

        const list: AnnouncementRowData[] = announcementItems.map((item) => mapAnnouncementApiItemToRow(item))

        setRows(list)
        setMeta({
          current_page: Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchAnnouncements()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleSort = (column: keyof AnnouncementRowData) => {
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

    const compare = (a: AnnouncementRowData, b: AnnouncementRowData) => {
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

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const colCount = showActions ? 9 : 8

  const totalPages = meta.last_page || 1

  const handleAnnouncementCreated = (announcement: AnnouncementRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== announcement.id)
      const next = [announcement, ...filtered]
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

  const handleAnnouncementUpdated = (announcement: AnnouncementRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === announcement.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = announcement
      return next
    })
  }

  const handleAnnouncementDeleted = (announcementId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== announcementId))

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

  return (
    <div>
      {isCreateModalOpen && (
        <AnnouncementCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(announcement) => {
            setIsCreateModalOpen(false)
            handleAnnouncementCreated(announcement)
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              Create Announcement
            </button>
          )}
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

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {(
                [
                  { key: 'imageUrl', label: 'Image' },
                  { key: 'title', label: 'Title' },
                  { key: 'subtitle', label: 'Subtitle' },
                  { key: 'bodyText', label: 'Body Text' },
                  { key: 'isActive', label: 'Status' },
                  { key: 'formattedStartAt', label: 'Start Date' },
                  { key: 'formattedEndAt', label: 'End Date' },
                  { key: 'sortOrder', label: 'Sort Order' },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key as keyof AnnouncementRowData)}
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
              sortedRows.map((announcement) => (
                <AnnouncementRow
                  key={announcement.id}
                  announcement={announcement}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={() => {
                    if (canUpdate) {
                      setEditingAnnouncementId(announcement.id)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(announcement)
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

      {editingAnnouncementId !== null && (
        <AnnouncementEditModal
          announcementId={editingAnnouncementId}
          onClose={() => setEditingAnnouncementId(null)}
          onSuccess={(announcement) => {
            setEditingAnnouncementId(null)
            handleAnnouncementUpdated(announcement)
          }}
        />
      )}

      {deleteTarget && (
        <AnnouncementDeleteModal
          announcement={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(announcementId) => {
            setDeleteTarget(null)
            handleAnnouncementDeleted(announcementId)
          }}
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
