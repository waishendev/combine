'use client'

import { useMemo, type ReactNode } from 'react'

import type { PosAppointmentListItem, PosScheduleStaff } from './posAppointmentTypes'
import PosAppointmentsDayGrid from './PosAppointmentsDayGrid'

export type { PosScheduleStaff }

export type PosAppointmentRow = PosAppointmentListItem

export type PosApptViewMode = 'month' | 'day'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const formatYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseIsoToLocalYmd = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return formatYmd(d)
}

const formatTimeLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

type Props = {
  viewMode: PosApptViewMode
  onViewModeChange: (mode: PosApptViewMode) => void
  calendarMonth: Date
  onCalendarMonthChange: (d: Date) => void
  dayDate: string
  onDayDateChange: (ymd: string) => void
  onMonthDayNavigateToDay: (ymd: string) => void
  appointments: PosAppointmentRow[]
  appointmentsLoading: boolean
  onOpenAppointment: (id: number) => void
  /** All active staff columns for DAY grid (not only those with bookings). */
  scheduleStaff?: PosScheduleStaff[]
  /** Staff IDs on approved leave for the selected day (DAY view). */
  staffOffTodayIds?: number[]
  filterSlot: ReactNode
}

export default function PosAppointmentsSchedule({
  viewMode,
  onViewModeChange,
  calendarMonth,
  onCalendarMonthChange,
  dayDate,
  onDayDateChange,
  onMonthDayNavigateToDay,
  appointments,
  appointmentsLoading,
  onOpenAppointment,
  scheduleStaff = [],
  staffOffTodayIds = [],
  filterSlot,
}: Props) {
  const calendarCells = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)
    const firstDayOfWeek = start.getDay()
    const cells: Array<{ date: Date | null }> = []
    for (let i = 0; i < firstDayOfWeek; i += 1) cells.push({ date: null })
    for (let d = 1; d <= end.getDate(); d += 1) {
      cells.push({ date: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d) })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [calendarMonth])

  const byYmd = useMemo(() => {
    const map = new Map<string, PosAppointmentRow[]>()
    appointments.forEach((row) => {
      const key = parseIsoToLocalYmd(row.appointment_start_at ?? null)
      if (!key) return
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    })
    map.forEach((list, key) => {
      list.sort((a, b) => {
        const ta = a.appointment_start_at ? new Date(a.appointment_start_at).getTime() : 0
        const tb = b.appointment_start_at ? new Date(b.appointment_start_at).getTime() : 0
        return ta - tb
      })
      map.set(key, list)
    })
    return map
  }, [appointments])

  const shiftDay = (ymd: string, delta: number) => {
    const [y, m, d] = ymd.split('-').map(Number)
    const next = new Date(y, m - 1, d + delta)
    return formatYmd(next)
  }

  const previewLinesForYmd = (ymd: string) => {
    const list = byYmd.get(ymd) ?? []
    const lines = list.slice(0, 3).map((row) => {
      const t = formatTimeLabel(row.appointment_start_at)
      const who = truncate(row.customer_name.trim() || '—', 10)
      return `${t} · ${who}`
    })
    const more = list.length > 3 ? list.length - 3 : 0
    return { lines, more }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {filterSlot}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('month')}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MONTH
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('day')}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DAY
          </button>
        </div>

        {viewMode === 'month' ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() =>
                onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
              }
            >
              Prev
            </button>
            <div className="min-w-[10rem] text-center text-sm font-semibold text-slate-800">
              {calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() =>
                onCalendarMonthChange(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </div>
        ) : (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => onDayDateChange(shiftDay(dayDate, -1))}
            >
              Prev day
            </button>
            <input
              type="date"
              value={dayDate}
              onChange={(e) => onDayDateChange(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            />
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={() => onDayDateChange(shiftDay(dayDate, 1))}
            >
              Next day
            </button>
          </div>
        )}
      </div>

      {viewMode === 'month' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs text-slate-500">
            Tap a date to open the <span className="font-semibold text-slate-700">day schedule</span> (staff columns &amp; time slots). Times shown in your local timezone.
          </p>
          <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-1 py-1 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.date) return <div key={`empty-${idx}`} className="min-h-[7.5rem] rounded border border-transparent" />

              const key = formatYmd(cell.date)
              const { lines, more } = previewLinesForYmd(key)
              const isToday = key === formatYmd(new Date())

              const hasBookings = lines.length > 0 || more > 0

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onMonthDayNavigateToDay(key)}
                  className={`flex min-h-[7.5rem] flex-col rounded border p-1.5 text-left transition hover:border-indigo-500 hover:bg-indigo-50/90 ${
                    hasBookings
                      ? 'border-indigo-400 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-200/80'
                      : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/80'
                  }`}
                >
                  <span className={`text-xs font-bold ${isToday ? 'text-blue-700' : 'text-slate-800'}`}>
                    {cell.date.getDate()}
                  </span>
                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {lines.length === 0 ? (
                      <span className="text-[10px] text-slate-400">—</span>
                    ) : (
                      lines.map((line, i) => (
                        <span
                          key={i}
                          className="line-clamp-2 rounded border border-indigo-400/90 bg-indigo-100 px-1 py-0.5 text-[9px] font-semibold leading-tight text-indigo-950 shadow-sm"
                          title={line}
                        >
                          {line}
                        </span>
                      ))
                    )}
                    {more > 0 ? (
                      <span className="mt-auto text-[9px] font-medium text-slate-500">+{more} more</span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {viewMode === 'day' ? (
        <div className="min-h-0 flex-1">
          {/* <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Schedule · {dayDate}
          </p> */}
          {/* <p className="mb-2 text-[11px] text-slate-500">
            15-minute grid · 8:00–21:00 · Click a block to open settlement on the right.
          </p> */}
          <PosAppointmentsDayGrid
            dayYmd={dayDate}
            appointments={appointments}
            loading={appointmentsLoading}
            onBlockClick={onOpenAppointment}
            scheduleStaff={scheduleStaff}
            staffOffTodayIds={staffOffTodayIds}
          />
        </div>
      ) : (
        <p className="text-xs text-slate-400"></p>
      )}
    </div>
  )
}
