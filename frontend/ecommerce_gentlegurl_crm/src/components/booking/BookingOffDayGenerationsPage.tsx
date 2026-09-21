'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import PaginationControls from '@/components/PaginationControls'
import TableEmptyState from '@/components/TableEmptyState'
import TableLoadingRow from '@/components/TableLoadingRow'
import { useBranch } from '@/contexts/BranchContext'
import { formatDateTime12Hour } from '@/lib/formatDateTime'

type GenerationRow = {
  id: number
  created_at: string
  staff_id: number
  store_location_id?: number | null
  remark: string | null
  after_value: unknown
  staff?: { id: number; name: string }
  creator?: { id: number; name: string }
  store_location?: { id: number; name: string } | null
}

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type StatusFilter = 'all' | 'active' | 'reverted'

type GenerationMeta = {
  createdIds: number[]
  revertedAt: string | null
  createdCount: number
  skippedCount: number
  scope: 'month' | 'year'
  targetLabel: string
  weekdays: string[]
}

const extractPaginated = (payload: unknown): { rows: GenerationRow[]; meta: PaginationMeta } => {
  const emptyMeta = { current_page: 1, last_page: 1, per_page: 20, total: 0 }
  if (!payload || typeof payload !== 'object') return { rows: [], meta: emptyMeta }
  const root = payload as { data?: unknown }
  if (!root.data || typeof root.data !== 'object') return { rows: [], meta: emptyMeta }
  const p = root.data as { data?: unknown; current_page?: number; last_page?: number; per_page?: number; total?: number }
  const rows = Array.isArray(p.data) ? (p.data as GenerationRow[]) : []
  return {
    rows,
    meta: {
      current_page: Number(p.current_page ?? 1),
      last_page: Number(p.last_page ?? 1),
      per_page: Number(p.per_page ?? 20),
      total: Number(p.total ?? rows.length),
    },
  }
}

const readMeta = (row: GenerationRow): GenerationMeta => {
  const after = row.after_value && typeof row.after_value === 'object'
    ? (row.after_value as Record<string, unknown>)
    : {}
  const createdIds = Array.isArray(after.created_ids)
    ? after.created_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : []
  const revertedAt = typeof after.reverted_at === 'string' ? after.reverted_at : null
  const createdCount = Number(after.created_count ?? createdIds.length) || 0
  const skippedCount = Number(after.skipped_count ?? 0) || 0
  const scope = after.scope === 'year' ? 'year' : 'month'
  const targetLabel = scope === 'year' ? String(after.target_year ?? '') : String(after.target_month ?? '')
  const weekdays = Array.isArray(after.weekday_labels) ? after.weekday_labels.map(String).filter(Boolean) : []
  return { createdIds, revertedAt, createdCount, skippedCount, scope, targetLabel, weekdays }
}

export default function BookingOffDayGenerationsPage({ permissions = [] }: { permissions?: string[] }) {
  const canRevert = permissions.includes('booking.schedules.update')
  const { selectedBranchId, isAllBranches } = useBranch()
  const [rows, setRows] = useState<GenerationRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [meta, setMeta] = useState<PaginationMeta>({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [confirmRow, setConfirmRow] = useState<GenerationRow | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('per_page', String(pageSize))
    if (selectedBranchId !== null) qs.set('store_location_id', String(selectedBranchId))
    try {
      const res = await fetch(`/api/proxy/admin/booking/off-day-generations?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Failed to load off-day generations.')
        setRows([])
        return
      }
      setError(null)
      const { rows: nextRows, meta: nextMeta } = extractPaginated(await res.json().catch(() => ({})))
      setRows(nextRows)
      setMeta(nextMeta)
    } catch {
      setError('Failed to load off-day generations.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, selectedBranchId])

  useEffect(() => {
    setPage(1)
  }, [selectedBranchId])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const visibleRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => {
      const reverted = Boolean(readMeta(row).revertedAt)
      return statusFilter === 'reverted' ? reverted : !reverted
    })
  }, [rows, statusFilter])

  const activeCount = useMemo(
    () => rows.filter((row) => !readMeta(row).revertedAt).length,
    [rows],
  )

  const revertGeneration = async (row: GenerationRow) => {
    const rowMeta = readMeta(row)
    if (!canRevert || rowMeta.revertedAt || rowMeta.createdIds.length === 0) return
    setError(null)
    setRevertingId(row.id)
    try {
      const res = await fetch(`/api/proxy/admin/booking/off-day-generations/${row.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: 'Revert off-day generation.' }),
      })
      const root = await res.json().catch(() => ({})) as {
        message?: string
        data?: { leave_log?: GenerationRow; cancelled_count?: number; skipped_count?: number }
      }
      if (!res.ok) {
        setError(root.message ?? 'Failed to revert generation.')
        return
      }
      const updated = root.data?.leave_log
      if (updated) {
        setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, ...updated } : item)))
      } else {
        await loadRows()
      }
      const cancelled = Number(root.data?.cancelled_count ?? rowMeta.createdCount)
      const skipped = Number(root.data?.skipped_count ?? 0)
      setToast(
        skipped > 0
          ? `Reverted ${cancelled} off day(s). ${skipped} already changed and were skipped.`
          : `Reverted ${cancelled} off day(s).`,
      )
      setConfirmRow(null)
    } catch {
      setError('Failed to revert generation.')
    } finally {
      setRevertingId(null)
    }
  }

  const confirmMeta = confirmRow ? readMeta(confirmRow) : null
  const colSpan = isAllBranches ? 9 : 8

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'reverted', label: 'Reverted' },
          ] as const).map((item) => {
            const selected = statusFilter === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  selected
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
                {item.id === 'active' && activeCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[11px]">{activeCount}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(1)
              setPageSize(Number(e.target.value))
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadRows()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Refresh"
          >
            <i className="fa-solid fa-rotate-right" />
            Refresh
          </button>
        </div>
      </div>

      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">When</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Staff</th>
              {isAllBranches ? (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Branch</th>
              ) : null}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Batch</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Weekdays</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Off days</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Created by</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colSpan} />
            ) : visibleRows.length === 0 ? (
              <TableEmptyState
                colSpan={colSpan}
                message={
                  statusFilter === 'active'
                    ? 'No active generations on this page.'
                    : statusFilter === 'reverted'
                      ? 'No reverted generations on this page.'
                      : 'No off-day generations yet. Generate from Leave Calendar first.'
                }
              />
            ) : (
              visibleRows.map((row) => {
                const rowMeta = readMeta(row)
                const canRevertRow = canRevert && !rowMeta.revertedAt && rowMeta.createdIds.length > 0
                return (
                  <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDateTime12Hour(row.created_at) || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.staff?.name ?? `Staff #${row.staff_id}`}
                    </td>
                    {isAllBranches ? (
                      <td className="px-4 py-3 text-slate-700">
                        {row.store_location?.name ?? (row.store_location_id ? 'Unknown Branch' : 'Unassigned')}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {rowMeta.scope === 'year' ? 'By Year' : 'By Month'}
                      </div>
                      <div className="text-xs text-slate-500">{rowMeta.targetLabel || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {rowMeta.weekdays.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rowMeta.weekdays.map((day) => (
                            <span
                              key={`${row.id}-${day}`}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {day.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{rowMeta.createdCount}</div>
                      {rowMeta.skippedCount > 0 ? (
                        <div className="text-xs text-slate-500">{rowMeta.skippedCount} skipped</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {rowMeta.revertedAt ? (
                        <div>
                          <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                            Reverted
                          </span>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {formatDateTime12Hour(rowMeta.revertedAt) || rowMeta.revertedAt}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.creator?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {canRevertRow ? (
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => {
                            setError(null)
                            setConfirmRow(row)
                          }}
                          disabled={revertingId === row.id}
                        >
                          Revert
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          {meta.total > 0
            ? `Showing page ${meta.current_page} of ${meta.last_page} · ${meta.total} batch(es)`
            : 'No batches'}
        </span>
        <PaginationControls
          currentPage={meta.current_page || page}
          totalPages={meta.last_page || 1}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {confirmRow && confirmMeta ? (
        <CrmFormModalShell
          title="Revert this generation?"
          onClose={() => {
            if (revertingId) return
            setConfirmRow(null)
          }}
          closeDisabled={revertingId === confirmRow.id}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                onClick={() => setConfirmRow(null)}
                disabled={revertingId === confirmRow.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={() => void revertGeneration(confirmRow)}
                disabled={revertingId === confirmRow.id}
              >
                {revertingId === confirmRow.id ? 'Reverting…' : `Revert ${confirmMeta.createdCount} off day(s)`}
              </button>
            </>
          }
        >
          <div className="space-y-3 p-5 text-sm text-slate-700">
            <p>
              This will cancel the off days created by this batch only. Manual leave / off days are not affected.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
              <p>
                <span className="text-slate-500">Staff:</span>{' '}
                <span className="font-semibold">{confirmRow.staff?.name ?? `Staff #${confirmRow.staff_id}`}</span>
              </p>
              <p>
                <span className="text-slate-500">Batch:</span>{' '}
                <span className="font-semibold">
                  {confirmMeta.scope === 'year' ? 'By Year' : 'By Month'}
                  {confirmMeta.targetLabel ? ` · ${confirmMeta.targetLabel}` : ''}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Weekdays:</span>{' '}
                <span className="font-semibold">
                  {confirmMeta.weekdays.length > 0 ? confirmMeta.weekdays.join(', ') : '—'}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Off days to cancel:</span>{' '}
                <span className="font-semibold">{confirmMeta.createdCount}</span>
              </p>
            </div>
          </div>
        </CrmFormModalShell>
      ) : null}
    </div>
  )
}
