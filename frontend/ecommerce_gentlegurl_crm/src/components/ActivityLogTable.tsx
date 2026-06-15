'use client'

import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'

type ActivityLogRow = {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  model_type: string
  model_id: number | null
  model_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string | null
}

type FilterOption = { id: number; name: string }

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const ACTION_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string; dotColor: string }> = {
  created: {
    label: 'Created',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    icon: 'fa-solid fa-plus',
    dotColor: 'bg-emerald-500',
  },
  updated: {
    label: 'Updated',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: 'fa-solid fa-pen',
    dotColor: 'bg-amber-500',
  },
  deleted: {
    label: 'Deleted',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: 'fa-solid fa-trash',
    dotColor: 'bg-red-500',
  },
}

const DEFAULT_ACTION_CONFIG = {
  label: 'Unknown',
  bg: 'bg-gray-50 border-gray-200',
  text: 'text-gray-600',
  icon: 'fa-solid fa-circle-question',
  dotColor: 'bg-gray-400',
}

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_CONFIG[action] ?? DEFAULT_ACTION_CONFIG
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.bg} ${config.text}`}>
      <i className={`${config.icon} text-[10px]`} />
      {config.label}
    </span>
  )
}

function UserAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
          <i className="fa-solid fa-robot text-[10px] text-slate-500" />
        </div>
        <span className="text-sm italic text-slate-400">System</span>
      </div>
    )
  }

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colors = [
    'from-blue-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-sky-600',
  ]
  const colorIndex = name.charCodeAt(0) % colors.length

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${colors[colorIndex]} shadow-sm`}>
        <span className="text-[10px] font-bold text-white leading-none">{initials}</span>
      </div>
      <span className="text-sm font-medium text-slate-800">{name}</span>
    </div>
  )
}

function ChangesCell({ log }: { log: ActivityLogRow }) {
  const [expanded, setExpanded] = useState(false)

  if (log.action === 'created') {
    if (!log.new_values || Object.keys(log.new_values).length === 0) {
      return <span className="text-gray-400 text-xs">—</span>
    }
    const entries = Object.entries(log.new_values)
    const visible = expanded ? entries : entries.slice(0, 3)
    return (
      <div className="space-y-1">
        {visible.map(([key, val]) => (
          <div key={key} className="flex items-start gap-1 text-xs">
            <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">{key}</span>
            <span className="text-emerald-700 break-all">{formatVal(val)}</span>
          </div>
        ))}
        {entries.length > 3 && (
          <button
            type="button"
            className="mt-0.5 text-xs font-medium text-blue-600 hover:text-blue-800"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `+${entries.length - 3} more fields`}
          </button>
        )}
      </div>
    )
  }

  if (log.action === 'updated') {
    if (!log.old_values || !log.new_values) {
      return <span className="text-gray-400 text-xs">—</span>
    }
    const keys = Object.keys(log.new_values)
    const visible = expanded ? keys : keys.slice(0, 3)
    return (
      <div className="space-y-1">
        {visible.map((key) => (
          <div key={key} className="text-xs">
            <span className="inline-block rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-600">{key}</span>
            <div className="mt-0.5 flex items-center gap-1 pl-1">
              <span className="text-red-500 line-through">{formatVal(log.old_values?.[key])}</span>
              <i className="fa-solid fa-arrow-right text-[8px] text-slate-400 mx-0.5" />
              <span className="font-medium text-emerald-700">{formatVal(log.new_values?.[key])}</span>
            </div>
          </div>
        ))}
        {keys.length > 3 && (
          <button
            type="button"
            className="mt-0.5 text-xs font-medium text-blue-600 hover:text-blue-800"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `+${keys.length - 3} more fields`}
          </button>
        )}
      </div>
    )
  }

  if (log.action === 'deleted') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500">
        <i className="fa-solid fa-circle-xmark text-[10px]" />
        Record deleted
      </span>
    )
  }

  return <span className="text-gray-400 text-xs">—</span>
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return '(empty)'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') return JSON.stringify(val)
  const str = String(val)
  return str.length > 60 ? str.slice(0, 60) + '…' : str
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, { bg: string; iconBg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 ring-blue-100', iconBg: 'bg-blue-500', text: 'text-blue-700' },
    emerald: { bg: 'bg-emerald-50 ring-emerald-100', iconBg: 'bg-emerald-500', text: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50 ring-amber-100', iconBg: 'bg-amber-500', text: 'text-amber-700' },
    red: { bg: 'bg-red-50 ring-red-100', iconBg: 'bg-red-500', text: 'text-red-700' },
  }
  const c = colorMap[color] ?? colorMap.blue

  return (
    <div className={`flex items-center gap-3 rounded-xl ${c.bg} ring-1 px-4 py-3`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg} shadow-sm`}>
        <i className={`${icon} text-white text-sm`} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`text-xl font-bold ${c.text}`}>{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

function TimeAgo({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-slate-400">—</span>

  const date = new Date(dateStr.replace(' ', 'T'))
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  let relative: string
  if (diffMin < 1) relative = 'just now'
  else if (diffMin < 60) relative = `${diffMin}m ago`
  else if (diffHr < 24) relative = `${diffHr}h ago`
  else if (diffDay < 7) relative = `${diffDay}d ago`
  else relative = dateStr

  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-slate-700">{relative}</span>
      <span className="text-[11px] text-slate-400">{dateStr}</span>
    </div>
  )
}

export default function ActivityLogTable() {
  const [rows, setRows] = useState<ActivityLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [modelTypeFilter, setModelTypeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [modelTypes, setModelTypes] = useState<string[]>([])
  const [users, setUsers] = useState<FilterOption[]>([])

  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    action: '',
    model_type: '',
    user_id: '',
    date_from: '',
    date_to: '',
  })

  const [detailLog, setDetailLog] = useState<ActivityLogRow | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (appliedFilters.search) qs.set('search', appliedFilters.search)
        if (appliedFilters.action) qs.set('action', appliedFilters.action)
        if (appliedFilters.model_type) qs.set('model_type', appliedFilters.model_type)
        if (appliedFilters.user_id) qs.set('user_id', appliedFilters.user_id)
        if (appliedFilters.date_from) qs.set('date_from', appliedFilters.date_from)
        if (appliedFilters.date_to) qs.set('date_to', appliedFilters.date_to)

        const res = await fetch(`/api/proxy/activity-logs?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          return
        }

        const json = await res.json().catch(() => null)
        if (!json?.data) {
          setRows([])
          return
        }

        const data = json.data
        setRows(Array.isArray(data.rows) ? data.rows : [])
        if (data.pagination) {
          setMeta({
            current_page: data.pagination.current_page ?? 1,
            last_page: data.pagination.last_page ?? 1,
            per_page: data.pagination.per_page ?? pageSize,
            total: data.pagination.total ?? 0,
          })
        }
        if (data.filters) {
          if (Array.isArray(data.filters.model_types)) {
            setModelTypes(data.filters.model_types)
          }
          if (Array.isArray(data.filters.users)) {
            setUsers(data.filters.users)
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRows([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchLogs()
    return () => controller.abort()
  }, [currentPage, pageSize, appliedFilters])

  const handleApplyFilters = () => {
    setAppliedFilters({
      search,
      action: actionFilter,
      model_type: modelTypeFilter,
      user_id: userFilter,
      date_from: dateFrom,
      date_to: dateTo,
    })
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setActionFilter('')
    setModelTypeFilter('')
    setUserFilter('')
    setDateFrom('')
    setDateTo('')
    setAppliedFilters({
      search: '',
      action: '',
      model_type: '',
      user_id: '',
      date_from: '',
      date_to: '',
    })
    setCurrentPage(1)
  }

  const hasActiveFilters = useMemo(() => {
    return Object.values(appliedFilters).some(Boolean)
  }, [appliedFilters])

  const activeFilterCount = useMemo(() => {
    return Object.values(appliedFilters).filter(Boolean).length
  }, [appliedFilters])

  const stats = useMemo(() => {
    const created = rows.filter((r) => r.action === 'created').length
    const updated = rows.filter((r) => r.action === 'updated').length
    const deleted = rows.filter((r) => r.action === 'deleted').length
    return { total: meta.total, created, updated, deleted }
  }, [rows, meta.total])

  const totalPages = meta.last_page || 1

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="fa-solid fa-list" label="Total Logs" value={stats.total} color="blue" />
        <StatCard icon="fa-solid fa-plus" label="Created" value={stats.created} color="emerald" />
        <StatCard icon="fa-solid fa-pen" label="Updated" value={stats.updated} color="amber" />
        <StatCard icon="fa-solid fa-trash" label="Deleted" value={stats.deleted} color="red" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            placeholder="Search by name or label..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
            showFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <i className="fa-solid fa-sliders text-xs" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={handleApplyFilters}
        >
          <i className="fa-solid fa-magnifying-glass text-xs" />
          Search
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
            onClick={handleResetFilters}
          >
            <i className="fa-solid fa-xmark text-xs" />
            Clear All
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {meta.total.toLocaleString()} record{meta.total !== 1 ? 's' : ''}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expandable Filters Panel */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Model Type</label>
              <select
                value={modelTypeFilter}
                onChange={(e) => setModelTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Types</option>
                {modelTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">User</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? `User #${u.id}`}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Active filters:</span>
          {appliedFilters.action && (
            <FilterTag label="Action" value={ACTION_CONFIG[appliedFilters.action]?.label ?? appliedFilters.action} onRemove={() => {
              setActionFilter('')
              setAppliedFilters((prev) => ({ ...prev, action: '' }))
            }} />
          )}
          {appliedFilters.model_type && (
            <FilterTag label="Model" value={appliedFilters.model_type} onRemove={() => {
              setModelTypeFilter('')
              setAppliedFilters((prev) => ({ ...prev, model_type: '' }))
            }} />
          )}
          {appliedFilters.user_id && (
            <FilterTag label="User" value={users.find((u) => String(u.id) === appliedFilters.user_id)?.name ?? `#${appliedFilters.user_id}`} onRemove={() => {
              setUserFilter('')
              setAppliedFilters((prev) => ({ ...prev, user_id: '' }))
            }} />
          )}
          {appliedFilters.search && (
            <FilterTag label="Search" value={appliedFilters.search} onRemove={() => {
              setSearch('')
              setAppliedFilters((prev) => ({ ...prev, search: '' }))
            }} />
          )}
          {appliedFilters.date_from && (
            <FilterTag label="From" value={appliedFilters.date_from} onRemove={() => {
              setDateFrom('')
              setAppliedFilters((prev) => ({ ...prev, date_from: '' }))
            }} />
          )}
          {appliedFilters.date_to && (
            <FilterTag label="To" value={appliedFilters.date_to} onRemove={() => {
              setDateTo('')
              setAppliedFilters((prev) => ({ ...prev, date_to: '' }))
            }} />
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[170px]">Time</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[100px]">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Changes</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-[60px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <TableLoadingRow colSpan={6} />
            ) : rows.length > 0 ? (
              rows.map((log) => {
                const config = ACTION_CONFIG[log.action] ?? DEFAULT_ACTION_CONFIG
                return (
                  <tr key={log.id} className="group transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <TimeAgo dateStr={log.created_at} />
                    </td>
                    <td className="px-4 py-3">
                      <UserAvatar name={log.user_name} />
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${config.dotColor}`} />
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-slate-500">{log.model_type}</span>
                          {log.model_id && (
                            <span className="ml-1 text-xs text-slate-400">#{log.model_id}</span>
                          )}
                          {log.model_label && (
                            <p className="truncate text-sm font-medium text-slate-800 max-w-[200px]" title={log.model_label}>
                              {log.model_label}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[320px]">
                      <ChangesCell log={log} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                        onClick={() => setDetailLog(log)}
                        title="View full details"
                      >
                        <i className="fa-solid fa-expand text-xs" />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <TableEmptyState colSpan={6} message="No activity logs found." />
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={(page) => {
          if (page >= 1 && page <= totalPages) setCurrentPage(page)
        }}
        disabled={loading}
      />

      {/* Detail Modal */}
      {detailLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDetailLog(null) }}
        >
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${(ACTION_CONFIG[detailLog.action] ?? DEFAULT_ACTION_CONFIG).bg} border`}>
                  <i className={`${(ACTION_CONFIG[detailLog.action] ?? DEFAULT_ACTION_CONFIG).icon} ${(ACTION_CONFIG[detailLog.action] ?? DEFAULT_ACTION_CONFIG).text} text-sm`} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Activity Detail</h3>
                  <p className="text-xs text-slate-500">{detailLog.model_type} #{detailLog.model_id}</p>
                </div>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setDetailLog(null)}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Meta Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon="fa-regular fa-clock" label="Time" value={detailLog.created_at ?? '—'} />
                <InfoCard icon="fa-regular fa-user" label="User" value={detailLog.user_name ?? 'System'} />
                <InfoCard icon="fa-solid fa-bolt" label="Action">
                  <ActionBadge action={detailLog.action} />
                </InfoCard>
                <InfoCard icon="fa-solid fa-cube" label="Target" value={`${detailLog.model_type} #${detailLog.model_id}`} />
                {detailLog.model_label && (
                  <InfoCard icon="fa-solid fa-tag" label="Label" value={detailLog.model_label} className="col-span-2" />
                )}
                {detailLog.ip_address && (
                  <InfoCard icon="fa-solid fa-globe" label="IP Address" value={detailLog.ip_address} mono />
                )}
              </div>

              {/* Changes Detail */}
              {detailLog.action === 'updated' && detailLog.old_values && detailLog.new_values && (
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <i className="fa-solid fa-code-compare text-xs text-amber-500" />
                    Changes ({Object.keys(detailLog.new_values).length} fields)
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide">Field</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-red-400 uppercase tracking-wide">Before</th>
                          <th className="px-4 py-2.5 text-left font-semibold text-emerald-500 uppercase tracking-wide">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.keys(detailLog.new_values).map((key) => (
                          <tr key={key} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2 font-mono font-medium text-slate-700">{key}</td>
                            <td className="px-4 py-2 text-red-600 break-all bg-red-50/30">{formatVal(detailLog.old_values?.[key])}</td>
                            <td className="px-4 py-2 text-emerald-700 break-all bg-emerald-50/30">{formatVal(detailLog.new_values?.[key])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailLog.action === 'created' && detailLog.new_values && (
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <i className="fa-solid fa-plus text-xs text-emerald-500" />
                    Created Values
                  </h4>
                  <pre className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs text-slate-700 overflow-x-auto max-h-60 font-mono leading-relaxed">
                    {JSON.stringify(detailLog.new_values, null, 2)}
                  </pre>
                </div>
              )}

              {detailLog.action === 'deleted' && detailLog.old_values && (
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <i className="fa-solid fa-trash text-xs text-red-500" />
                    Deleted Values
                  </h4>
                  <pre className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-xs text-red-700 overflow-x-auto max-h-60 font-mono leading-relaxed">
                    {JSON.stringify(detailLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-b-2xl">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => setDetailLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterTag({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs">
      <span className="font-medium text-blue-600">{label}:</span>
      <span className="text-blue-800">{value}</span>
      <button
        type="button"
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-blue-400 transition hover:bg-blue-200 hover:text-blue-700"
        onClick={onRemove}
      >
        <i className="fa-solid fa-xmark text-[9px]" />
      </button>
    </span>
  )
}

function InfoCard({ icon, label, value, mono, className, children }: {
  icon: string
  label: string
  value?: string
  mono?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <i className={`${icon} text-[10px] text-slate-400`} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      {children ?? (
        <p className={`text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      )}
    </div>
  )
}
