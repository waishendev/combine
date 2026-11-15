'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import { useBranch } from '@/contexts/BranchContext'

type LeaveType = 'annual' | 'mc' | 'emergency' | 'unpaid' | 'off_day'
type DayType = 'full_day' | 'half_day_am' | 'half_day_pm'

type UserRef = { id: number; name: string }

type LeaveRow = {
  id: number
  staff_id: number
  leave_type: LeaveType
  day_type: DayType
  start_date: string
  end_date: string
  reason: string | null
  status?: string
  staff?: { id: number; name: string; is_active?: boolean }
  reviewer?: UserRef | null
  creation_log?: { creator?: UserRef | null } | null
  store_location_id?: number | null
  store_location?: { id: number; name: string } | null
}

type LeaveLogEntry = {
  id: number
  action_type: string
  remark: string | null
  created_at: string
  before_value: unknown
  after_value: unknown
  creator?: UserRef | null
}

type BookingLeaveCalendarPageProps = {
  permissions?: string[]
}

type BranchOption = { id: number; name: string }
type StaffOption = { staff_id: number; staff_name: string; store_locations: BranchOption[] }

function MultiBranchCheckboxField({
  branches,
  values,
  onChange,
  disabled = false,
  hint,
}: {
  branches: BranchOption[]
  values: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  hint?: string
}) {
  if (branches.length === 0) {
    return (
      <div className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        This Staff has no eligible accessible Branch. Action is unavailable.
      </div>
    )
  }
  if (branches.length === 1) {
    return (
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-700">Branch</label>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{branches[0].name}</div>
      </div>
    )
  }
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Branches <span className="text-rose-600">*</span>
      </label>
      <div className="space-y-2 rounded-md border border-slate-200 bg-white px-3 py-2">
        {branches.map((branch) => {
          const checked = values.includes(branch.id)
          return (
            <label key={branch.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  if (checked) onChange(values.filter((id) => id !== branch.id))
                  else onChange([...values, branch.id])
                }}
              />
              <span>{branch.name}</span>
            </label>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {hint ?? 'Only Branches you can access and this Staff is assigned to are listed. Leave balance stays shared.'}
      </p>
    </div>
  )
}

type LeaveGroup = {
  key: string
  staff_id: number
  leave_type: LeaveType
  day_type: DayType
  start_date: string
  end_date: string
  items: LeaveRow[]
}

function leaveGroupKey(item: LeaveRow): string {
  const start = toBusinessDateKey(item.start_date) ?? item.start_date
  const end = toBusinessDateKey(item.end_date) ?? item.end_date
  return `${item.staff_id}|${item.leave_type}|${item.day_type}|${start}|${end}`
}

function buildLeaveGroups(items: LeaveRow[], mergeAcrossBranches: boolean): LeaveGroup[] {
  if (!mergeAcrossBranches) {
    return items.map((item) => ({
      key: `id:${item.id}`,
      staff_id: item.staff_id,
      leave_type: item.leave_type,
      day_type: item.day_type,
      start_date: item.start_date,
      end_date: item.end_date,
      items: [item],
    }))
  }

  const map = new Map<string, LeaveGroup>()
  for (const item of items) {
    const key = leaveGroupKey(item)
    const existing = map.get(key)
    if (existing) existing.items.push(item)
    else {
      map.set(key, {
        key,
        staff_id: item.staff_id,
        leave_type: item.leave_type,
        day_type: item.day_type,
        start_date: item.start_date,
        end_date: item.end_date,
        items: [item],
      })
    }
  }
  return Array.from(map.values())
}

function branchIdsFromItems(items: LeaveRow[]): number[] {
  return items
    .map((item) => item.store_location_id)
    .filter((id): id is number => typeof id === 'number' && id > 0)
}

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual Leave',
  mc: 'Medical Leave (MC)',
  emergency: 'Emergency Leave',
  unpaid: 'Unpaid Leave',
  off_day: 'Off Day',
}

const LEAVE_CLASS: Record<LeaveType, string> = {
  annual: 'bg-blue-100 text-blue-700',
  mc: 'bg-orange-100 text-orange-700',
  emergency: 'bg-rose-100 text-rose-700',
  unpaid: 'bg-violet-100 text-violet-700',
  off_day: 'bg-slate-200 text-slate-700',
}

const LEAVE_CARD_SHELL: Record<LeaveType, string> = {
  annual: 'border-blue-200 bg-blue-50 text-blue-900',
  mc: 'border-orange-200 bg-orange-50 text-orange-900',
  emergency: 'border-rose-200 bg-rose-50 text-rose-900',
  unpaid: 'border-violet-200 bg-violet-50 text-violet-900',
  off_day: 'border-slate-300 bg-slate-100 text-slate-800',
}

const LEAVE_DOT_CLASS: Record<LeaveType, string> = {
  annual: 'bg-blue-500',
  mc: 'bg-orange-500',
  emergency: 'bg-rose-500',
  unpaid: 'bg-violet-500',
  off_day: 'bg-slate-500',
}

const WEEKDAY_HEADERS: Array<{ short: string; full: string }> = [
  { short: 'S', full: 'Sun' },
  { short: 'M', full: 'Mon' },
  { short: 'T', full: 'Tue' },
  { short: 'W', full: 'Wed' },
  { short: 'T', full: 'Thu' },
  { short: 'F', full: 'Fri' },
  { short: 'S', full: 'Sat' },
]

const formatCalendarLeaveLabel = (item: LeaveRow): string => {
  const base = LEAVE_LABEL[item.leave_type]
  if (item.day_type === 'full_day') return base
  return `${base} · ${DAY_TYPE_LABEL[item.day_type]}`
}

const staffFirstName = (name: string | undefined, staffId: number) => {
  const full = name?.trim() || `Staff #${staffId}`
  return full.split(/\s+/)[0] ?? full
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  full_day: 'Full Day',
  half_day_am: 'Half Day (morning)',
  half_day_pm: 'Half Day (afternoon)',
}

const extractArray = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const nested = (root.data as { data?: unknown }).data
    if (Array.isArray(nested)) return nested as T[]
  }
  return []
}

const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

const toBusinessDateKey = (value: string): string | null => {
  const matched = value.match(DATE_ONLY_PATTERN)
  if (!matched) return null
  return `${matched[1]}-${matched[2]}-${matched[3]}`
}

const parseYmdLocal = (value: string): Date | null => {
  const key = toBusinessDateKey(value)
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const formatDateRange = (startDate: string, endDate: string): string => {
  const startKey = toBusinessDateKey(startDate)
  const endKey = toBusinessDateKey(endDate)

  if (!startKey && !endKey) return '-'
  if (!startKey) return endKey ?? '-'
  if (!endKey) return startKey
  if (startKey === endKey) return startKey

  return `${startKey} → ${endKey}`
}

const LOG_ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  adjusted: 'Adjusted',
  updated: 'Updated',
}

const resolveCreatedBy = (item: LeaveRow): string => {
  if (item.reviewer?.name) return item.reviewer.name
  if (item.creation_log?.creator?.name) return item.creation_log.creator.name
  return '-'
}

const isSingleDayRange = (startDate: string, endDate: string): boolean => {
  const startKey = toBusinessDateKey(startDate)
  const endKey = toBusinessDateKey(endDate)
  return Boolean(startKey && endKey && startKey === endKey)
}

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const formatWeekdayLabel = (value: string): string => {
  const parsed = parseYmdLocal(value)
  if (!parsed) return '-'
  return WEEKDAY_OPTIONS[parsed.getDay()]?.label ?? '-'
}

const readLogDate = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>)[key]
  if (typeof raw !== 'string') return null
  return toBusinessDateKey(raw) ?? raw.slice(0, 10)
}

const readLogBranchId = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null
  const raw = (value as Record<string, unknown>).store_location_id
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw)
  return null
}

const formatLogChange = (log: LeaveLogEntry): string => {
  const beforeStart = readLogDate(log.before_value, 'start_date')
  const beforeEnd = readLogDate(log.before_value, 'end_date')
  const afterStart = readLogDate(log.after_value, 'start_date')
  const afterEnd = readLogDate(log.after_value, 'end_date')
  const beforeBranch = readLogBranchId(log.before_value)
  const afterBranch = readLogBranchId(log.after_value)

  const parts: string[] = []
  if (beforeStart && afterStart && (beforeStart !== afterStart || beforeEnd !== afterEnd)) {
    const beforeText = beforeStart === beforeEnd ? beforeStart : `${beforeStart} → ${beforeEnd}`
    const afterText = afterStart === afterEnd ? afterStart : `${afterStart} → ${afterEnd}`
    parts.push(`${beforeText} → ${afterText}`)
  }
  if (beforeBranch !== afterBranch && (beforeBranch != null || afterBranch != null)) {
    parts.push(`Branch #${beforeBranch ?? 'unassigned'} → #${afterBranch ?? 'unassigned'}`)
  }
  if (parts.length > 0) return parts.join(' · ')

  return log.remark ?? LOG_ACTION_LABEL[log.action_type] ?? log.action_type
}

const canEditApprovedLeave = (item: LeaveRow, canUpdate: boolean): boolean =>
  canUpdate && (item.status ?? 'approved') === 'approved' && ['off_day', 'annual', 'mc', 'emergency', 'unpaid'].includes(item.leave_type)

/** Leave start date is today or earlier (local calendar day). */
const leaveStartsOnOrBeforeToday = (item: LeaveRow, todayKey: string): boolean => {
  const startKey = (item.start_date || '').slice(0, 10)
  return Boolean(startKey) && startKey <= todayKey
}

const canCancelApprovedLeave = (
  item: LeaveRow,
  canUpdate: boolean,
  canCancelPast: boolean,
  todayKey: string,
): boolean => {
  if (
    !canUpdate ||
    (item.status ?? 'approved') !== 'approved' ||
    !['off_day', 'annual', 'mc', 'emergency', 'unpaid'].includes(item.leave_type)
  ) {
    return false
  }
  if (leaveStartsOnOrBeforeToday(item, todayKey) && !canCancelPast) return false
  return true
}

const monthToTargetValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

type GenerateOffDaysResponse = {
  created_count?: number
  skipped_count?: number
  created_ids?: number[]
}

const formatGenerateSummary = (payload: GenerateOffDaysResponse): string => {
  const created = Number(payload.created_count ?? 0)
  const skipped = Number(payload.skipped_count ?? 0)
  if (created === 0 && skipped === 0) return 'No matching dates in the selected period.'
  const parts = [`Created ${created} off day(s).`]
  if (skipped > 0) parts.push(`${skipped} date(s) skipped (already booked).`)
  return parts.join(' ')
}

function WeekdayCheckboxGrid({
  selected,
  disabled = false,
  onChange,
}: {
  selected: number[]
  disabled?: boolean
  onChange: (days: number[]) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {WEEKDAY_OPTIONS.map((day) => {
        const checked = selected.includes(day.value)
        return (
          <label
            key={day.value}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              checked ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-emerald-600"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selected, day.value].sort((a, b) => a - b)
                    : selected.filter((value) => value !== day.value),
                )
              }}
            />
            <span>{day.label}</span>
          </label>
        )
      })}
    </div>
  )
}

type PageToast = { id: string; message: string; title: string }

function LeaveCalendarSuccessPanel({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="rounded-xl border-2 border-emerald-400 bg-gradient-to-b from-emerald-50 to-white px-5 py-6 text-center shadow-sm ring-4 ring-emerald-100/80"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <i className="fa-solid fa-circle-check text-3xl" aria-hidden />
      </div>
      <p className="text-lg font-bold text-emerald-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-emerald-800">{message}</p>
    </div>
  )
}

function LeaveCalendarErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800" role="alert">
      {message}
    </div>
  )
}

export default function BookingLeaveCalendarPage({ permissions = [] }: BookingLeaveCalendarPageProps) {
  const { selectedBranchId, isAllBranches } = useBranch()
  /** Leave Calendar Details Edit / Cancel / sync Off Day to another Branch. */
  const canManageLeaveCalendar = permissions.includes('booking.leave.calendar.manage')
  /** Cancel leave that starts today or earlier — infra / SuperAdmin only. */
  const canCancelPastLeave = permissions.includes('booking.leave.calendar.cancel-past')
  /** Off Days / By Weekday / By Year — infra / SuperAdmin only. */
  const canManageOffDayTools = permissions.includes('booking.off_day_generations.view')
  const canUpdate = canManageLeaveCalendar
  const leaveCalendarOffDayBase = '/api/proxy/admin/booking/leave-calendar/off-days'
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [staffFilter, setStaffFilter] = useState('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | ''>('')
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOffDayModalOpen, setIsOffDayModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isGenerateYearModalOpen, setIsGenerateYearModalOpen] = useState(false)
  const [cancelTargets, setCancelTargets] = useState<LeaveRow[] | null>(null)
  const [offDayForm, setOffDayForm] = useState({ staff_id: '', store_location_ids: [] as number[], start_date: '', end_date: '', reason: '' })
  const [generateForm, setGenerateForm] = useState({
    staff_id: '',
    store_location_ids: [] as number[],
    target_month: monthToTargetValue(now),
    days_of_week: [] as number[],
  })
  const [generateYearForm, setGenerateYearForm] = useState({
    staff_id: '',
    store_location_ids: [] as number[],
    target_year: String(now.getFullYear()),
    days_of_week: [] as number[],
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreatingOffDay, setIsCreatingOffDay] = useState(false)
  const [generateSummary, setGenerateSummary] = useState<string | null>(null)
  const [pageToasts, setPageToasts] = useState<PageToast[]>([])
  const [editingGroup, setEditingGroup] = useState<LeaveGroup | null>(null)
  const [editOffDayForm, setEditOffDayForm] = useState({ start_date: '', end_date: '', reason: '', store_location_ids: [] as number[] })
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)
  const [logsByRequestId, setLogsByRequestId] = useState<Record<number, LeaveLogEntry[]>>({})
  const [logsLoadingId, setLogsLoadingId] = useState<number | null>(null)
  const [expandedLogsId, setExpandedLogsId] = useState<number | null>(null)

  const eligibleBranches = (staffId: string) => staffOptions.find((staff) => String(staff.staff_id) === staffId)?.store_locations ?? []
  const initialBranchIds = (staffId: string): number[] => {
    const branches = eligibleBranches(staffId)
    return branches.length === 1 ? [branches[0].id] : []
  }
  const resolveBranchIdsForSubmit = (staffId: string, formBranchIds: number[]): number[] | null => {
    if (selectedBranchId !== null) return [selectedBranchId]
    const branches = eligibleBranches(staffId)
    if (branches.length === 1) return [branches[0].id]
    const allowed = new Set(branches.map((branch) => branch.id))
    const selected = formBranchIds.filter((id) => allowed.has(id))
    return selected.length > 0 ? selected : null
  }

  const dismissPageToast = useCallback((id: string) => {
    setPageToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushPageToast = useCallback((title: string, message: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    setPageToasts((prev) => [...prev, { id, title, message }].slice(-3))
    window.setTimeout(() => dismissPageToast(id), 7000)
  }, [dismissPageToast])

  const loadStaffOptions = async () => {
    const res = await fetch(`/api/proxy/admin/booking/leave-balances?${selectedBranchId !== null ? `store_location_id=${selectedBranchId}` : 'accessible_union=1'}`, { cache: 'no-store' })
    if (!res.ok) return
    setStaffOptions(extractArray<StaffOption>(await res.json().catch(() => ({}))))
  }

  const loadRows = async () => {
    setCalendarLoading(true)
    setRows([])
    try {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)

      const qs = new URLSearchParams()
      qs.set('status', 'approved')
      qs.set('from_date', formatDate(monthStart))
      qs.set('to_date', formatDate(monthEnd))
      qs.set('per_page', '500')
      if (staffFilter) qs.set('staff_id', staffFilter)
      if (leaveTypeFilter) qs.set('leave_type', leaveTypeFilter)
      if (selectedBranchId !== null) qs.set('store_location_id', String(selectedBranchId))

      const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setRows([])
        return
      }

      setRows(extractArray<LeaveRow>(await res.json().catch(() => ({}))))
    } finally {
      setCalendarLoading(false)
    }
  }

  const closeOffDayModal = () => {
    setError(null)
    setIsOffDayModalOpen(false)
  }

  const closeGenerateModal = () => {
    setError(null)
    setGenerateSummary(null)
    setIsGenerateModalOpen(false)
  }

  const closeGenerateYearModal = () => {
    setError(null)
    setGenerateSummary(null)
    setIsGenerateYearModalOpen(false)
  }

  const openGenerateModal = () => {
    setError(null)
    setGenerateSummary(null)
    setGenerateForm({
      staff_id: staffFilter || '',
      store_location_ids: initialBranchIds(staffFilter || ''),
      target_month: monthToTargetValue(month),
      days_of_week: [],
    })
    setIsGenerateModalOpen(true)
  }

  const openGenerateYearModal = () => {
    setError(null)
    setGenerateSummary(null)
    setGenerateYearForm({
      staff_id: staffFilter || '',
      store_location_ids: initialBranchIds(staffFilter || ''),
      target_year: String(month.getFullYear()),
      days_of_week: [],
    })
    setIsGenerateYearModalOpen(true)
  }

  const generateOffDaysFromWeeklySchedule = async () => {
    setError(null)
    setGenerateSummary(null)

    if (!generateForm.staff_id || !generateForm.target_month) {
      setError('Please select staff and target month.')
      return
    }
    const branchIds = resolveBranchIdsForSubmit(generateForm.staff_id, generateForm.store_location_ids)
    if (branchIds === null) { setError('Select at least one eligible Branch before generating off days.'); return }

    if (generateForm.days_of_week.length === 0) {
      setError('Please select at least one weekday.')
      return
    }

    setIsGenerating(true)
    try {
      let created = 0
      let skipped = 0
      const errors: string[] = []
      for (const branchId of branchIds) {
        const res = await fetch('/api/proxy/admin/booking/off-days/generate-from-weekly-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: Number(generateForm.staff_id),
            store_location_id: branchId,
            target_month: generateForm.target_month,
            days_of_week: generateForm.days_of_week,
          }),
        })
        const root = await res.json().catch(() => ({})) as { data?: GenerateOffDaysResponse; message?: string }
        if (!res.ok) {
          errors.push(root.message ?? `Branch #${branchId} failed.`)
          continue
        }
        created += Number(root.data?.created_count ?? 0)
        skipped += Number(root.data?.skipped_count ?? 0)
      }
      if (errors.length > 0 && created === 0) {
        setError(errors.join(' '))
        return
      }
      setGenerateSummary(
        [
          formatGenerateSummary({ created_count: created, skipped_count: skipped }),
          branchIds.length > 1 ? `Across ${branchIds.length} Branches.` : null,
          errors.length > 0 ? `Some Branches failed: ${errors.join(' ')}` : null,
        ].filter(Boolean).join(' '),
      )
      await loadRows()
    } catch {
      setError('Failed to generate off days.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateOffDaysFromYearSchedule = async () => {
    setError(null)
    setGenerateSummary(null)

    if (!generateYearForm.staff_id || !generateYearForm.target_year) {
      setError('Please select staff and target year.')
      return
    }
    const branchIds = resolveBranchIdsForSubmit(generateYearForm.staff_id, generateYearForm.store_location_ids)
    if (branchIds === null) { setError('Select at least one eligible Branch before generating off days.'); return }

    if (generateYearForm.days_of_week.length === 0) {
      setError('Please select at least one weekday.')
      return
    }

    setIsGenerating(true)
    try {
      let created = 0
      let skipped = 0
      const errors: string[] = []
      for (const branchId of branchIds) {
        const res = await fetch('/api/proxy/admin/booking/off-days/generate-from-weekly-schedule-by-year', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: Number(generateYearForm.staff_id),
            store_location_id: branchId,
            target_year: Number(generateYearForm.target_year),
            days_of_week: generateYearForm.days_of_week,
          }),
        })
        const root = await res.json().catch(() => ({})) as { data?: GenerateOffDaysResponse; message?: string }
        if (!res.ok) {
          errors.push(root.message ?? `Branch #${branchId} failed.`)
          continue
        }
        created += Number(root.data?.created_count ?? 0)
        skipped += Number(root.data?.skipped_count ?? 0)
      }
      if (errors.length > 0 && created === 0) {
        setError(errors.join(' '))
        return
      }
      setGenerateSummary(
        [
          formatGenerateSummary({ created_count: created, skipped_count: skipped }),
          branchIds.length > 1 ? `Across ${branchIds.length} Branches.` : null,
          errors.length > 0 ? `Some Branches failed: ${errors.join(' ')}` : null,
        ].filter(Boolean).join(' '),
      )
      await loadRows()
    } catch {
      setError('Failed to generate off days.')
    } finally {
      setIsGenerating(false)
    }
  }

  const loadOffDayLogs = async (leaveRequestId: number) => {
    setLogsLoadingId(leaveRequestId)
    try {
      const qs = new URLSearchParams()
      qs.set('leave_request_id', String(leaveRequestId))
      qs.set('per_page', '20')
      const res = await fetch(`/api/proxy/admin/booking/leave-logs?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setLogsByRequestId((prev) => ({ ...prev, [leaveRequestId]: [] }))
        return
      }
      const rows = extractArray<LeaveLogEntry>(await res.json().catch(() => ({})))
      setLogsByRequestId((prev) => ({ ...prev, [leaveRequestId]: rows }))
    } finally {
      setLogsLoadingId(null)
    }
  }

  const toggleOffDayLogs = async (leaveRequestId: number) => {
    if (expandedLogsId === leaveRequestId) {
      setExpandedLogsId(null)
      return
    }
    setExpandedLogsId(leaveRequestId)
    if (!logsByRequestId[leaveRequestId]) {
      await loadOffDayLogs(leaveRequestId)
    }
  }

  const openEditGroup = (group: LeaveGroup) => {
    setError(null)
    setEditingGroup(group)
    const startKey = toBusinessDateKey(group.start_date) ?? ''
    const endKey = toBusinessDateKey(group.end_date) ?? startKey
    const existingBranchIds = branchIdsFromItems(group.items)
    const staffBranches = eligibleBranches(String(group.staff_id))
    const selectedIds = existingBranchIds.filter((id) => staffBranches.some((branch) => branch.id === id))
    setEditOffDayForm({
      start_date: startKey,
      end_date: endKey,
      reason: group.items.find((item) => item.reason)?.reason ?? '',
      store_location_ids: selectedIds.length > 0 ? selectedIds : initialBranchIds(String(group.staff_id)),
    })
  }

  const closeEditGroup = () => {
    setError(null)
    setEditingGroup(null)
  }

  const saveEditGroup = async () => {
    if (!editingGroup) return
    setError(null)

    const startDate = editOffDayForm.start_date
    const endDate = isSingleDayRange(editingGroup.start_date, editingGroup.end_date)
      ? startDate
      : (editOffDayForm.end_date || startDate)

    if (!startDate || !endDate) {
      setError('Please select the new date(s).')
      return
    }

    const staffBranches = eligibleBranches(String(editingGroup.staff_id))
    const allowed = new Set(staffBranches.map((branch) => branch.id))
    const existingByBranch = new Map<number, LeaveRow>()
    for (const item of editingGroup.items) {
      if (item.store_location_id) existingByBranch.set(item.store_location_id, item)
    }
    const existingIds = [...existingByBranch.keys()]

    // Multi-branch tick sync (add/remove Branch coverage) for users with leave calendar manage.
    const canSyncBranches = isAllBranches && canManageLeaveCalendar && editingGroup.leave_type === 'off_day'

    let selectedBranchIds: number[]
    if (!isAllBranches || !canManageLeaveCalendar) {
      selectedBranchIds = existingIds.length > 0
        ? existingIds
        : (selectedBranchId !== null ? [selectedBranchId] : [])
    } else if (editingGroup.leave_type === 'off_day') {
      selectedBranchIds = editOffDayForm.store_location_ids.filter((id) => allowed.has(id))
      if (staffBranches.length === 1) selectedBranchIds = [staffBranches[0].id]
    } else {
      selectedBranchIds = existingIds
    }

    if (selectedBranchIds.length === 0) {
      setError(canSyncBranches ? 'Select at least one Branch.' : 'No Branch on this leave record.')
      return
    }

    const toKeep = selectedBranchIds.filter((id) => existingByBranch.has(id))
    const toAdd = canSyncBranches
      ? selectedBranchIds.filter((id) => !existingByBranch.has(id))
      : []
    const toRemove = canSyncBranches
      ? existingIds.filter((id) => !selectedBranchIds.includes(id))
      : []

    setActionLoadingKey(editingGroup.key)
    const errors: string[] = []
    try {
      for (const branchId of toKeep) {
        const item = existingByBranch.get(branchId)
        if (!item) continue
        const res = await fetch(`${leaveCalendarOffDayBase}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            reason: editOffDayForm.reason || null,
            store_location_id: branchId,
          }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string }
          errors.push(payload.message ?? `Failed to update Branch #${branchId}.`)
        }
      }

      for (const branchId of toAdd) {
        const res = await fetch(leaveCalendarOffDayBase, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: editingGroup.staff_id,
            store_location_id: branchId,
            start_date: startDate,
            end_date: endDate,
            reason: editOffDayForm.reason || null,
          }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string }
          errors.push(payload.message ?? `Failed to add Branch #${branchId}.`)
        }
      }

      for (const branchId of toRemove) {
        const item = existingByBranch.get(branchId)
        if (!item) continue
        const res = await fetch(`${leaveCalendarOffDayBase}/${item.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string }
          errors.push(payload.message ?? `Failed to remove Branch #${branchId}.`)
        }
      }

      if (errors.length > 0) {
        setError(errors.join(' '))
        await loadRows()
        return
      }

      const names = selectedBranchIds
        .map((id) => staffBranches.find((branch) => branch.id === id)?.name ?? `Branch #${id}`)
        .join(', ')
      closeEditGroup()
      setExpandedLogsId(null)
      await loadRows()
      pushPageToast(
        'Leave updated',
        `${LEAVE_LABEL[editingGroup.leave_type]} · ${formatDateRange(startDate, endDate)} · ${names}`,
      )
    } finally {
      setActionLoadingKey(null)
    }
  }

  const closeCancelOffDay = () => {
    if (actionLoadingKey != null) return
    setCancelTargets(null)
    setError(null)
  }

  const confirmCancelOffDay = async () => {
    if (!cancelTargets || cancelTargets.length === 0) return

    setError(null)
    setActionLoadingKey('cancel:group')
    try {
      const errors: string[] = []
      for (const target of cancelTargets) {
        const res = await fetch(`${leaveCalendarOffDayBase}/${target.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string }
          errors.push(payload.message ?? `Failed to cancel #${target.id}.`)
        }
      }
      if (errors.length > 0) {
        setError(errors.join(' '))
        await loadRows()
        return
      }

      setCancelTargets(null)
      setExpandedLogsId(null)
      await loadRows()
    } finally {
      setActionLoadingKey(null)
    }
  }

  const createOffDay = async () => {
    setError(null)
    if (!offDayForm.staff_id || !offDayForm.start_date || !offDayForm.end_date) {
      setError('Please complete staff and date fields for Off Day.')
      return
    }
    const branchIds = resolveBranchIdsForSubmit(offDayForm.staff_id, offDayForm.store_location_ids)
    if (branchIds === null) { setError('Select at least one eligible Branch before creating the Off Day.'); return }

    const staffName = staffOptions.find((row) => String(row.staff_id) === offDayForm.staff_id)?.staff_name ?? 'Staff'
    const dateRange = formatDateRange(offDayForm.start_date, offDayForm.end_date)

    setIsCreatingOffDay(true)
    try {
      const errors: string[] = []
      let created = 0
      for (const branchId of branchIds) {
        const res = await fetch('/api/proxy/admin/booking/off-days', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: Number(offDayForm.staff_id),
            store_location_id: branchId,
            start_date: offDayForm.start_date,
            end_date: offDayForm.end_date,
            reason: offDayForm.reason || null,
          }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({})) as { message?: string }
          errors.push(payload.message ?? `Branch #${branchId} failed.`)
          continue
        }
        created += 1
      }

      if (created === 0) {
        setError(errors.join(' ') || 'Failed to create off day.')
        return
      }

      pushPageToast(
        'Off day created',
        `${staffName} · ${dateRange}${branchIds.length > 1 ? ` · ${created} Branch(es)` : ''}${errors.length ? ` (${errors.length} failed)` : ''}`,
      )
      setOffDayForm({ staff_id: '', store_location_ids: [], start_date: '', end_date: '', reason: '' })
      setIsOffDayModalOpen(false)
      await loadRows()
    } finally {
      setIsCreatingOffDay(false)
    }
  }

  useEffect(() => {
    void loadStaffOptions()
    closeEditGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId])

  useEffect(() => {
    setSelectedDate(null)
    closeEditGroup()
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, staffFilter, leaveTypeFilter, selectedBranchId])

  const calendarDays = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const firstDayOfWeek = start.getDay()
    const totalDays = end.getDate()

    const cells: Array<{ date: Date | null }> = []
    for (let i = 0; i < firstDayOfWeek; i += 1) cells.push({ date: null })
    for (let d = 1; d <= totalDays; d += 1) cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d) })

    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [month])

  const todayKey = useMemo(() => formatDate(new Date()), [])

  const activeStaffIds = useMemo(
    () => new Set(staffOptions.map((staff) => staff.staff_id)),
    [staffOptions],
  )

  const leaveByDate = useMemo(() => {
    const map = new Map<string, LeaveRow[]>()
    rows.forEach((row) => {
      // Prefer active staff list from leave-balances; also drop inactive when staff payload says so.
      const staffActiveFlag = (row.staff as { is_active?: boolean } | undefined)?.is_active
      if (staffActiveFlag === false) return
      if (activeStaffIds.size > 0 && !activeStaffIds.has(row.staff_id)) return

      const start = parseYmdLocal(row.start_date)
      const end = parseYmdLocal(row.end_date)
      if (!start || !end) return

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(new Date(d))
        const list = map.get(key) ?? []
        list.push(row)
        map.set(key, list)
      }
    })
    return map
  }, [activeStaffIds, rows])

  const selectedItems = selectedDate ? (leaveByDate.get(selectedDate) ?? []) : []
  const selectedGroups = useMemo(
    () => buildLeaveGroups(selectedItems, isAllBranches),
    [selectedItems, isAllBranches],
  )

  return (
    <div className="space-y-4">
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-3 px-4">
        {pageToasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-4 shadow-xl ring-4 ring-emerald-100"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <i className="fa-solid fa-circle-check text-xl" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-base font-bold text-emerald-900">{toast.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-emerald-800">{toast.message}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-emerald-700 transition hover:bg-emerald-100"
              aria-label="Dismiss notification"
              onClick={() => dismissPageToast(toast.id)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        ))}
      </div>

      {isOffDayModalOpen && (
        <CrmFormModalShell
          title="Create Off Days"
          onClose={closeOffDayModal}
          closeDisabled={isCreatingOffDay}
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeOffDayModal}
                disabled={isCreatingOffDay}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                onClick={createOffDay}
                disabled={isCreatingOffDay || (isAllBranches && resolveBranchIdsForSubmit(offDayForm.staff_id, offDayForm.store_location_ids) === null)}
              >
                {isCreatingOffDay ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <div className="space-y-3 p-5">
            <p className="text-xs text-slate-500">
              Off Day is admin-managed and blocks booking availability without deducting leave balance.
            </p>

            {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={offDayForm.staff_id}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, staff_id: e.target.value, store_location_ids: initialBranchIds(e.target.value) }))}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              {isAllBranches && offDayForm.staff_id && (
                <MultiBranchCheckboxField
                  branches={eligibleBranches(offDayForm.staff_id)}
                  values={offDayForm.store_location_ids}
                  onChange={(store_location_ids) => setOffDayForm((prev) => ({ ...prev, store_location_ids }))}
                  disabled={isCreatingOffDay}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="date"
                  value={offDayForm.start_date}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="date"
                  value={offDayForm.end_date}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Reason"
                  value={offDayForm.reason}
                  onChange={(e) => setOffDayForm((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CrmFormModalShell>
      )}

      {isGenerateModalOpen && (
        <CrmFormModalShell
          title="Generate Monthly Off Days by Weekday"
          onClose={closeGenerateModal}
          closeDisabled={isGenerating}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeGenerateModal}
                disabled={isGenerating}
              >
                {generateSummary ? 'Close' : 'Cancel'}
              </button>
              {!generateSummary && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  onClick={generateOffDaysFromWeeklySchedule}
                  disabled={isGenerating || (isAllBranches && resolveBranchIdsForSubmit(generateForm.staff_id, generateForm.store_location_ids) === null)}
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              )}
              {generateSummary ? (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                  onClick={closeGenerateModal}
                >
                  Done
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3 p-5">
            {generateSummary ? (
              <LeaveCalendarSuccessPanel title="Generation complete" message={generateSummary} />
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Mark every selected weekday in the target month as off days for this staff.
                </p>

                {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={generateForm.staff_id}
                  onChange={(e) => setGenerateForm((prev) => ({ ...prev, staff_id: e.target.value, store_location_ids: initialBranchIds(e.target.value) }))}
                  disabled={isGenerating}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              {isAllBranches && generateForm.staff_id && (
                <MultiBranchCheckboxField
                  branches={eligibleBranches(generateForm.staff_id)}
                  values={generateForm.store_location_ids}
                  onChange={(store_location_ids) => setGenerateForm((prev) => ({ ...prev, store_location_ids }))}
                  disabled={isGenerating}
                />
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target month</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="month"
                  value={generateForm.target_month}
                  onChange={(e) => setGenerateForm((prev) => ({ ...prev, target_month: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Weekday(s)</label>
                <WeekdayCheckboxGrid
                  selected={generateForm.days_of_week}
                  disabled={isGenerating}
                  onChange={(days_of_week) => setGenerateForm((prev) => ({ ...prev, days_of_week }))}
                />
              </div>
            </div>
              </>
            )}
          </div>
        </CrmFormModalShell>
      )}

      {isGenerateYearModalOpen && (
        <CrmFormModalShell
          title="Generate Yearly Off Days by Weekday"
          onClose={closeGenerateYearModal}
          closeDisabled={isGenerating}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
                onClick={closeGenerateYearModal}
                disabled={isGenerating}
              >
                {generateSummary ? 'Close' : 'Cancel'}
              </button>
              {!generateSummary && (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  onClick={generateOffDaysFromYearSchedule}
                  disabled={isGenerating || (isAllBranches && resolveBranchIdsForSubmit(generateYearForm.staff_id, generateYearForm.store_location_ids) === null)}
                >
                  {isGenerating ? 'Generating…' : 'Generate'}
                </button>
              )}
              {generateSummary ? (
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                  onClick={closeGenerateYearModal}
                >
                  Done
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3 p-5">
            {generateSummary ? (
              <LeaveCalendarSuccessPanel title="Generation complete" message={generateSummary} />
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Mark every selected weekday across the full target year as off days for this staff. Existing off days on those dates are skipped.
                </p>

                {error ? <LeaveCalendarErrorBanner message={error} /> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={generateYearForm.staff_id}
                  onChange={(e) => setGenerateYearForm((prev) => ({ ...prev, staff_id: e.target.value, store_location_ids: initialBranchIds(e.target.value) }))}
                  disabled={isGenerating}
                >
                  <option value="">Select Staff</option>
                  {staffOptions.map((row) => (
                    <option key={row.staff_id} value={row.staff_id}>
                      {row.staff_name}
                    </option>
                  ))}
                </select>
              </div>

              {isAllBranches && generateYearForm.staff_id && (
                <MultiBranchCheckboxField
                  branches={eligibleBranches(generateYearForm.staff_id)}
                  values={generateYearForm.store_location_ids}
                  onChange={(store_location_ids) => setGenerateYearForm((prev) => ({ ...prev, store_location_ids }))}
                  disabled={isGenerating}
                />
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target year</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  type="number"
                  min={2000}
                  max={2100}
                  value={generateYearForm.target_year}
                  onChange={(e) => setGenerateYearForm((prev) => ({ ...prev, target_year: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Weekday(s)</label>
                <WeekdayCheckboxGrid
                  selected={generateYearForm.days_of_week}
                  disabled={isGenerating}
                  onChange={(days_of_week) => setGenerateYearForm((prev) => ({ ...prev, days_of_week }))}
                />
              </div>
            </div>
              </>
            )}
          </div>
        </CrmFormModalShell>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3">
          {canManageOffDayTools ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
            <button
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-600 sm:min-h-0"
              onClick={() => { setError(null); setIsOffDayModalOpen(true) }}
              type="button"
            >
              <i className="fa-solid fa-plus" />
              Off Days
            </button>

            <button
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 sm:min-h-0"
              onClick={openGenerateModal}
              type="button"
            >
              <i className="fa-solid fa-calendar-week" />
              By Weekday
            </button>

            <button
              className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-teal-700 sm:col-span-1 sm:min-h-0"
              onClick={openGenerateYearModal}
              type="button"
            >
              <i className="fa-solid fa-calendar-days" />
              By Year
            </button>
          </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Staff</label>
              <select className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm sm:min-h-0" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="">All Staff</option>
                {staffOptions.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.staff_name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Leave Type</label>
              <select className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-sm sm:min-h-0" value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value as LeaveType | '')}>
                <option value="">All Types</option>
                {Object.entries(LEAVE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 sm:ml-auto sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <i className="fa-solid fa-chevron-left text-xs" />
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-slate-800 sm:min-w-40">
              {month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <i className="fa-solid fa-chevron-right text-xs" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm sm:p-4">
        {calendarLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 px-4 py-12 sm:min-h-[28rem]"
          >
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="crm-loading-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
              <span className="crm-loading-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: '160ms' }} />
              <span className="crm-loading-dot h-2 w-2 rounded-full bg-slate-400" style={{ animationDelay: '320ms' }} />
            </div>
            <p className="text-sm font-medium text-slate-500">Loading leave calendar…</p>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-7 gap-px text-[10px] font-semibold text-slate-500 sm:gap-2 sm:text-xs">
          {WEEKDAY_HEADERS.map((day) => (
            <div key={day.full} className="py-1.5 text-center sm:px-1 sm:py-2">
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.full}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px sm:gap-2">
          {calendarDays.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="min-h-[5.25rem] rounded-sm border border-transparent sm:min-h-28" />
            }

            const key = formatDate(cell.date)
            const items = leaveByDate.get(key) ?? []
            const isSelected = selectedDate === key
            const isToday = key === todayKey

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (editingGroup) closeEditGroup()
                  setSelectedDate(key)
                }}
                className={`min-h-[5.25rem] overflow-hidden rounded-sm border p-0.5 text-left transition active:scale-[0.98] sm:min-h-28 sm:rounded sm:p-1 ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50/80 ring-2 ring-blue-300'
                    : isToday
                      ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-300'
                      : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div
                    className={`text-[11px] font-bold sm:text-xs ${
                      isSelected ? 'text-blue-800' : isToday ? 'text-sky-800' : 'text-slate-700'
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  {isToday ? (
                    <span className="rounded bg-sky-600 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white sm:text-[9px]">
                      Today
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 space-y-0.5 sm:hidden">
                  {items.length === 1 ? (
                    <div
                      className={`rounded border px-1 py-0.5 ${LEAVE_CARD_SHELL[items[0].leave_type]}`}
                      title={`${items[0].staff?.name ?? `Staff #${items[0].staff_id}`} · ${formatCalendarLeaveLabel(items[0])}`}
                    >
                      <div className="truncate text-[8px] font-bold leading-tight">
                        {staffFirstName(items[0].staff?.name, items[0].staff_id)}
                      </div>
                      <div className="line-clamp-2 text-[7px] font-medium leading-tight opacity-90">
                        {LEAVE_LABEL[items[0].leave_type]}
                      </div>
                    </div>
                  ) : items.length > 1 ? (
                    <>
                      <span className="inline-flex rounded-full bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-white">
                        {items.length}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {items.slice(0, 3).map((item) => (
                          <span
                            key={`dot-${item.id}-${item.staff_id}`}
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LEAVE_DOT_CLASS[item.leave_type]}`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Desktop: compact cards with truncation */}
                <div className="mt-1 hidden space-y-1 overflow-hidden sm:block">
                  {items.slice(0, 2).map((item) => (
                    <div key={`${item.id}-${item.staff_id}`} className="overflow-hidden rounded border border-slate-200 bg-white px-1.5 py-1">
                      <div className="truncate text-[10px] font-semibold text-slate-900">
                        {item.staff?.name ?? `Staff #${item.staff_id}`}
                      </div>
                      {isAllBranches && <div className="truncate text-[9px] font-medium text-slate-600">{item.store_location?.name ?? (item.store_location_id ? 'Unknown Branch' : 'Unassigned')}</div>}
                      <div className="mt-0.5 overflow-hidden">
                        <span
                          className={`block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${LEAVE_CLASS[item.leave_type]}`}
                          title={formatCalendarLeaveLabel(item)}
                        >
                          {formatCalendarLeaveLabel(item)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="truncate text-[10px] text-slate-500">+{items.length - 2} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
          </>
        )}
      </div>

      {selectedDate && !calendarLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-base font-semibold sm:text-lg">Details · {selectedDate}</h4>
          </div>

          {error && !editingGroup ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-3 space-y-3 text-sm">
            {selectedGroups.length === 0 && <p className="text-slate-500">No leave records on this date.</p>}
            {selectedGroups.map((group) => {
              const primary = group.items[0]
              const logs = logsByRequestId[primary.id] ?? []
              const showLogs = expandedLogsId === primary.id
              const canEdit = group.items.some((item) => canEditApprovedLeave(item, canUpdate))
              const canCancel = group.items.some((item) =>
                canCancelApprovedLeave(item, canUpdate, canCancelPastLeave, todayKey),
              )
              const manageable = canEdit || canCancel
              const isLoading = actionLoadingKey === group.key
              const isEditing = editingGroup?.key === group.key
              const staffBranches = eligibleBranches(String(group.staff_id))
              const branchNames = group.items
                .map((item) => item.store_location?.name ?? (item.store_location_id ? 'Unknown Branch' : 'Unassigned'))
                .filter((name, index, arr) => arr.indexOf(name) === index)

              return (
                <div
                  key={group.key}
                  className={`overflow-hidden rounded-lg border ${
                    isEditing
                      ? 'border-blue-300 bg-white shadow-md ring-1 ring-blue-200'
                      : manageable
                        ? 'border-slate-200 bg-white shadow-sm'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-slate-900">
                          {primary.staff?.name ?? `Staff #${group.staff_id}`}
                        </div>
                        {!isEditing ? (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-medium text-slate-500">
                                {branchNames.length > 1 ? 'Branches' : 'Branch'}
                              </span>
                              {branchNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                                  title={name}
                                >
                                  <span className="truncate">{name}</span>
                                </span>
                              ))}
                            </div>
                            <div className="mt-1.5 text-xs text-slate-500">
                              {formatDateRange(group.start_date, group.end_date)}
                              {isSingleDayRange(group.start_date, group.end_date) ? ` · ${formatWeekdayLabel(group.start_date)}` : ''}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">
                              <span className="font-medium text-slate-500">Created by</span> {resolveCreatedBy(primary)}
                            </div>
                          </>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            {isAllBranches && canManageLeaveCalendar && group.leave_type === 'off_day'
                              ? 'Change dates and tick the Branches this Off Day should cover. Untick to remove from a Branch.'
                              : 'Update the date/reason for this leave only.'}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ${LEAVE_CLASS[group.leave_type]}`}>
                        {LEAVE_LABEL[group.leave_type]}
                        {group.day_type !== 'full_day' ? ` · ${DAY_TYPE_LABEL[group.day_type]}` : ''}
                      </span>
                    </div>

                    {!isEditing && primary.reason ? (
                      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        <span className="font-medium text-slate-500">Reason</span>
                        <div className="mt-0.5">{primary.reason}</div>
                      </div>
                    ) : null}

                    {isEditing ? (
                      <div className="mt-4 space-y-3">
                        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                        {isAllBranches && canManageLeaveCalendar && group.leave_type === 'off_day' ? (
                          <MultiBranchCheckboxField
                            branches={staffBranches}
                            values={editOffDayForm.store_location_ids}
                            onChange={(store_location_ids) => setEditOffDayForm((prev) => ({ ...prev, store_location_ids }))}
                            disabled={isLoading}
                            hint="Tick Branches to keep/add. Untick an existing Branch to cancel that Off Day only."
                          />
                        ) : (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Branch</label>
                            <div className="flex flex-wrap gap-1.5">
                              {(branchNames.length > 0 ? branchNames : [staffBranches[0]?.name ?? '—']).map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Branch cannot be changed here. Open All Branches to transfer or cover other Branches.
                            </p>
                          </div>
                        )}

                        {isSingleDayRange(group.start_date, group.end_date) ? (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
                            <input
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                              type="date"
                              value={editOffDayForm.start_date}
                              onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, start_date: e.target.value, end_date: e.target.value }))}
                              disabled={isLoading}
                            />
                            {editOffDayForm.start_date ? (
                              <p className="mt-1 text-[11px] text-slate-500">Weekday: {formatWeekdayLabel(editOffDayForm.start_date)}</p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">Start date</label>
                              <input
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                type="date"
                                value={editOffDayForm.start_date}
                                onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, start_date: e.target.value }))}
                                disabled={isLoading}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">End date</label>
                              <input
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                type="date"
                                value={editOffDayForm.end_date}
                                onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, end_date: e.target.value }))}
                                disabled={isLoading}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">Reason (optional)</label>
                          <input
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                            value={editOffDayForm.reason}
                            onChange={(e) => setEditOffDayForm((prev) => ({ ...prev, reason: e.target.value }))}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(manageable || isEditing) && (
                    <>
                      <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
                        <button
                          type="button"
                          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900 sm:min-h-0 sm:justify-start"
                          onClick={() => void toggleOffDayLogs(primary.id)}
                          disabled={isEditing && isLoading}
                        >
                          <i className={`fa-solid ${showLogs ? 'fa-chevron-up' : 'fa-clock-rotate-left'} text-[11px]`} />
                          {showLogs ? 'Hide activity log' : 'Activity log'}
                        </button>

                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                            <button
                              type="button"
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                              onClick={closeEditGroup}
                              disabled={isLoading}
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                              onClick={() => void saveEditGroup()}
                              disabled={isLoading}
                            >
                              {isLoading ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        ) : (
                          <div className={`grid gap-2 sm:flex sm:items-center ${canEdit && canCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {canEdit ? (
                              <button
                                type="button"
                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => openEditGroup(group)}
                                disabled={isLoading || editingGroup != null}
                                title={`Edit ${LEAVE_LABEL[group.leave_type]}`}
                              >
                                <i className="fa-solid fa-pen-to-square text-[11px]" />
                                Edit
                              </button>
                            ) : null}
                            {canCancel ? (
                              <button
                                type="button"
                                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-medium text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => {
                                  setError(null)
                                  setCancelTargets(
                                    group.items.filter((item) =>
                                      canCancelApprovedLeave(item, canUpdate, canCancelPastLeave, todayKey),
                                    ),
                                  )
                                }}
                                disabled={isLoading || editingGroup != null}
                                title={`Cancel ${LEAVE_LABEL[group.leave_type]}`}
                              >
                                <i className="fa-solid fa-ban text-[11px]" />
                                {isLoading ? 'Working…' : 'Cancel'}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {showLogs && (
                        <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                          {logsLoadingId === primary.id && <p className="text-xs text-slate-500">Loading logs…</p>}
                          {!logsLoadingId && logs.length === 0 && <p className="text-xs text-slate-500">No activity yet.</p>}
                          {logs.map((log) => (
                            <div key={log.id} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                  {LOG_ACTION_LABEL[log.action_type] ?? log.action_type}
                                </span>
                                <span className="text-slate-500">
                                  {new Date(log.created_at).toLocaleString('en-MY', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="mt-1.5 text-slate-700">{formatLogChange(log)}</div>
                              <div className="mt-1 text-slate-500">By {log.creator?.name ?? '-'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {cancelTargets && cancelTargets.length > 0 && (
        <CrmFormModalShell
          title={`Cancel ${LEAVE_LABEL[cancelTargets[0].leave_type]}`}
          onClose={closeCancelOffDay}
          closeDisabled={actionLoadingKey === 'cancel:group'}
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                onClick={closeCancelOffDay}
                disabled={actionLoadingKey === 'cancel:group'}
              >
                Keep
              </button>
              <button
                type="button"
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={() => void confirmCancelOffDay()}
                disabled={actionLoadingKey === 'cancel:group'}
              >
                {actionLoadingKey === 'cancel:group' ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </>
          }
        >
          <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
            <p>
              Cancel {LEAVE_LABEL[cancelTargets[0].leave_type]} for{' '}
              <span className="font-semibold text-slate-900">
                {cancelTargets[0].staff?.name ?? `Staff #${cancelTargets[0].staff_id}`}
              </span>
              {cancelTargets.length > 1 ? ` on ${cancelTargets.length} Branches` : ''}
              ?
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-500">Date</span>{' '}
                {formatDateRange(cancelTargets[0].start_date, cancelTargets[0].end_date)}
              </div>
              {isAllBranches ? (
                <div className="mt-1">
                  <span className="font-medium text-slate-500">Branches</span>{' '}
                  {cancelTargets
                    .map((item) => item.store_location?.name ?? (item.store_location_id ? 'Unknown Branch' : 'Unassigned'))
                    .join(' · ')}
                </div>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              This removes the approved leave from the calendar
              {['annual', 'mc', 'emergency'].includes(cancelTargets[0].leave_type)
                ? ' and returns the days to leave balance'
                : ''}
              .
            </p>
            {error ? <LeaveCalendarErrorBanner message={error} /> : null}
          </div>
        </CrmFormModalShell>
      )}

    </div>
  )
}
