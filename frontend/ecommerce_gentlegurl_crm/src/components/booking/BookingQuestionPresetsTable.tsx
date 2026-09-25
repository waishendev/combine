'use client'

import { useCallback, useEffect, useState } from 'react'

import StatusBadge from '@/components/StatusBadge'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import PaginationControls from '@/components/PaginationControls'
import BookingQuestionPresetUpsertModal, {
  type QuestionPresetRow,
} from './BookingQuestionPresetUpsertModal'
import type { QuestionPresetOption } from './BookingServiceQuestionPresetPickerModal'
import BookingServiceQuestionPresetViewModal from './BookingServiceQuestionPresetViewModal'

interface Props {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type PresetListRow = QuestionPresetRow & {
  questions?: QuestionPresetOption['questions']
}

export default function BookingQuestionPresetsTable({ permissions }: Props) {
  const canCreate =
    permissions.includes('booking.question_presets.create') ||
    permissions.includes('booking.services.create') ||
    permissions.includes('booking.services.update')
  const canUpdate =
    permissions.includes('booking.question_presets.update') ||
    permissions.includes('booking.services.update')
  const canDelete =
    permissions.includes('booking.question_presets.delete') ||
    permissions.includes('booking.services.delete')
  const showActions = true

  const [rows, setRows] = useState<PresetListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Meta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [viewingPreset, setViewingPreset] = useState<QuestionPresetOption | null>(null)
  const [viewLoadingId, setViewLoadingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: String(currentPage),
        per_page: String(pageSize),
      })
      const res = await fetch(`/api/proxy/admin/booking/question-presets?${qs}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to load presets')
      }
      const payload = data?.data
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : []
      setRows(
        list.map((item: Record<string, unknown>) => ({
          id: Number(item.id),
          name: String(item.name ?? ''),
          cn_name: (item.cn_name as string | null) ?? null,
          is_active: item.is_active !== false,
          attached_services_count: Number(item.attached_services_count ?? 0),
          questions_count: Array.isArray(item.questions)
            ? item.questions.length
            : Number(item.questions_count ?? 0),
          questions: Array.isArray(item.questions)
            ? (item.questions as QuestionPresetOption['questions'])
            : [],
        })),
      )
      setMeta({
        current_page: Number(payload?.current_page ?? currentPage),
        last_page: Number(payload?.last_page ?? 1),
        per_page: Number(payload?.per_page ?? pageSize),
        total: Number(payload?.total ?? list.length),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  const handleView = async (row: PresetListRow) => {
    if (row.questions && row.questions.length > 0) {
      setViewingPreset({
        id: row.id,
        name: row.name,
        cn_name: row.cn_name,
        is_active: row.is_active,
        questions: row.questions,
      })
      return
    }

    setViewLoadingId(row.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/question-presets/${row.id}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to load preset')
      }
      const preset = data?.data ?? {}
      setViewingPreset({
        id: Number(preset.id ?? row.id),
        name: String(preset.name ?? row.name),
        cn_name: (preset.cn_name as string | null) ?? row.cn_name,
        is_active: preset.is_active !== false,
        questions: Array.isArray(preset.questions) ? preset.questions : [],
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to load preset')
    } finally {
      setViewLoadingId(null)
    }
  }

  const handleDelete = async (row: QuestionPresetRow) => {
    if (!canDelete) return
    const ok = window.confirm(
      `Delete preset "${row.name}"? Services using it will lose these preset questions; custom questions stay.`,
    )
    if (!ok) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/question-presets/${row.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Delete failed')
      }
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const colCount = showActions ? 5 : 4

  return (
    <div className="space-y-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
            >
              <i className="fa-solid fa-plus" />
              Create Preset
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="question-preset-page-size" className="text-sm text-gray-700">
            Show
          </label>
          <select
            id="question-preset-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70 text-left">
            <tr>
              <th className="px-4 py-2 font-semibold uppercase tracking-wider text-gray-600">Name</th>
              <th className="px-4 py-2 font-semibold uppercase tracking-wider text-gray-600">Questions</th>
              <th className="px-4 py-2 font-semibold uppercase tracking-wider text-gray-600">
                Attached services
              </th>
              <th className="px-4 py-2 font-semibold uppercase tracking-wider text-gray-600">Status</th>
              {showActions ? (
                <th className="px-4 py-2 font-semibold tracking-wider text-gray-600">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length === 0 ? (
              <TableEmptyState colSpan={colCount} message="No question presets yet." />
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-4 py-2">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    {row.cn_name ? <div className="text-xs text-gray-500">{row.cn_name}</div> : null}
                  </td>
                  <td className="border border-gray-200 px-4 py-2">{row.questions_count ?? 0}</td>
                  <td className="border border-gray-200 px-4 py-2">{row.attached_services_count ?? 0}</td>
                  <td className="border border-gray-200 px-4 py-2">
                    <StatusBadge
                      status={row.is_active ? 'active' : 'inactive'}
                      label={row.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  {showActions ? (
                    <td className="border border-gray-200 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50"
                          onClick={() => void handleView(row)}
                          disabled={viewLoadingId === row.id}
                          aria-label="View preset"
                          title="View"
                        >
                          <i className={`fa-solid ${viewLoadingId === row.id ? 'fa-spinner fa-spin' : 'fa-eye'}`} />
                        </button>
                        {canUpdate ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => setEditingId(row.id)}
                            aria-label="Edit preset"
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            disabled={deletingId === row.id}
                            onClick={() => void handleDelete(row)}
                            aria-label="Delete preset"
                            title="Delete"
                          >
                            <i className={`fa-solid ${deletingId === row.id ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PaginationControls
          currentPage={meta.current_page}
          totalPages={meta.last_page}
          pageSize={meta.per_page}
          onPageChange={setCurrentPage}
          disabled={loading}
        />
      </div>

      {isCreateOpen ? (
        <BookingQuestionPresetUpsertModal
          mode="create"
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => void load()}
        />
      ) : null}
      {editingId != null ? (
        <BookingQuestionPresetUpsertModal
          mode="edit"
          presetId={editingId}
          onClose={() => setEditingId(null)}
          onSuccess={() => void load()}
        />
      ) : null}
      {viewingPreset ? (
        <BookingServiceQuestionPresetViewModal
          preset={viewingPreset}
          onClose={() => setViewingPreset(null)}
        />
      ) : null}
    </div>
  )
}
