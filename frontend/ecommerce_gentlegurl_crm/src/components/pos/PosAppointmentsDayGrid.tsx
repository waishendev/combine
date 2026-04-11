'use client'

import { useMemo } from 'react'

import {
  posAppointmentDayBlockClass,
  posAppointmentDayBlockSubtextClass,
  posAppointmentVisualTone,
} from './posAppointmentHelpers'
import type { PosAppointmentListItem, PosScheduleStaff } from './posAppointmentTypes'

const SLOT_MINUTES = 15
const DAY_START_MIN = 8 * 60
const DAY_END_MIN = 21 * 60
const SLOT_PX = 22

const formatYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseIsoToLocalYmd = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return formatYmd(d)
}

const minutesFromMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes()

const formatTimeLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`)

type StaffColumnKey = string

const UNASSIGNED_KEY = 'unassigned'

function staffColumnKeyLegacy(row: PosAppointmentListItem): StaffColumnKey {
  if (row.staff_id != null && row.staff_id > 0) return `id:${row.staff_id}`
  return `name:${(row.staff_name ?? 'Unassigned').trim() || 'Unassigned'}`
}

function staffColumnLabelLegacy(row: PosAppointmentListItem): string {
  const name = (row.staff_name ?? '').trim()
  return name || 'Unassigned'
}

function assignLanes(
  items: Array<{ id: number; start: number; end: number }>,
): Map<number, { lane: number; laneCount: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const laneEnds: number[] = []
  const out = new Map<number, { lane: number; laneCount: number }>()

  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => it.start >= end)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(it.end)
    } else {
      laneEnds[lane] = Math.max(laneEnds[lane], it.end)
    }
    out.set(it.id, { lane, laneCount: 0 })
  }

  const laneCount = Math.max(1, laneEnds.length)
  out.forEach((v, id) => {
    out.set(id, { lane: v.lane, laneCount })
  })
  return out
}

type ColumnDef = {
  key: StaffColumnKey
  label: string
  staffId: number | null
  isOff: boolean
}

type Props = {
  dayYmd: string
  appointments: PosAppointmentListItem[]
  loading: boolean
  onBlockClick: (id: number) => void
  scheduleStaff: PosScheduleStaff[]
  staffOffTodayIds: number[]
}

export default function PosAppointmentsDayGrid({
  dayYmd,
  appointments,
  loading,
  onBlockClick,
  scheduleStaff,
  staffOffTodayIds,
}: Props) {
  const dayRows = useMemo(() => {
    return appointments.filter((row) => parseIsoToLocalYmd(row.appointment_start_at ?? null) === dayYmd)
  }, [appointments, dayYmd])

  const staffIdsFromSchedule = useMemo(() => new Set(scheduleStaff.map((s) => s.id)), [scheduleStaff])

  const staffColumns = useMemo((): ColumnDef[] => {
    if (scheduleStaff.length > 0) {
      const sorted = [...scheduleStaff].sort((a, b) => a.name.localeCompare(b.name))
      const needUnassigned = dayRows.some((row) => {
        const sid = row.staff_id
        return sid == null || sid <= 0 || !staffIdsFromSchedule.has(sid)
      })
      const cols: ColumnDef[] = sorted.map((s) => ({
        key: `id:${s.id}`,
        label: s.name,
        staffId: s.id,
        isOff: staffOffTodayIds.includes(s.id),
      }))
      if (needUnassigned) {
        cols.push({
          key: UNASSIGNED_KEY,
          label: 'Unassigned',
          staffId: null,
          isOff: false,
        })
      }
      return cols
    }

    const map = new Map<StaffColumnKey, ColumnDef>()
    dayRows.forEach((row) => {
      const k = staffColumnKeyLegacy(row)
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          label: staffColumnLabelLegacy(row),
          staffId: row.staff_id && row.staff_id > 0 ? row.staff_id : null,
          isOff: false,
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [dayRows, scheduleStaff, staffIdsFromSchedule, staffOffTodayIds])

  const rowColumnKey = useMemo(() => {
    return (row: PosAppointmentListItem): StaffColumnKey => {
      if (scheduleStaff.length > 0) {
        const sid = row.staff_id
        if (sid != null && sid > 0 && staffIdsFromSchedule.has(sid)) return `id:${sid}`
        return UNASSIGNED_KEY
      }
      return staffColumnKeyLegacy(row)
    }
  }, [scheduleStaff.length, staffIdsFromSchedule])

  const blocksByStaff = useMemo(() => {
    const byStaff = new Map<StaffColumnKey, PosAppointmentListItem[]>()
    dayRows.forEach((row) => {
      const k = rowColumnKey(row)
      const list = byStaff.get(k) ?? []
      list.push(row)
      byStaff.set(k, list)
    })
    return byStaff
  }, [dayRows, rowColumnKey])

  const totalSlots = Math.ceil((DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES)
  const gridHeight = totalSlots * SLOT_PX

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Loading schedule…</div>
    )
  }

  if (scheduleStaff.length === 0 && staffColumns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No appointments for this date. Adjust filters or pick another day.
      </div>
    )
  }

  const HEADER_H = 44

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex min-w-full border-b border-slate-200 bg-slate-100">
        <div className="w-14 shrink-0" style={{ minHeight: HEADER_H }} />
        {staffColumns.map((col) => (
          <div
            key={`h-${col.key}`}
            className={`flex min-w-[132px] max-w-[200px] flex-1 flex-col items-center justify-center border-l px-1 py-1.5 text-center ${
              col.isOff
                ? 'border-red-300 bg-red-100 text-red-950'
                : 'border-slate-200 bg-slate-100 text-slate-800'
            }`}
            style={{ minHeight: HEADER_H }}
          >
            <span className="text-[11px] font-bold leading-tight">{truncate(col.label, 24)}</span>
            {col.isOff ? <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-red-800">Off / Leave</span> : null}
          </div>
        ))}
      </div>

      <div className="inline-flex min-w-full">
        <div
          className="w-14 shrink-0 border-r border-slate-200 bg-slate-50"
          style={{ height: gridHeight }}
        >
          {Array.from({ length: totalSlots }, (_, i) => {
            const slotStart = DAY_START_MIN + i * SLOT_MINUTES
            const showLabel = slotStart % 60 === 0
            const label = showLabel
              ? new Date(2000, 0, 1, Math.floor(slotStart / 60), slotStart % 60, 0).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : ''
            return (
              <div
                key={slotStart}
                className="border-b border-slate-100 text-[10px] leading-none text-slate-500"
                style={{ height: SLOT_PX, paddingTop: 2, paddingLeft: 4 }}
              >
                {label}
              </div>
            )
          })}
        </div>

        {staffColumns.map((col) => {
          const rows = blocksByStaff.get(col.key) ?? []
          const intervals = rows
            .map((row) => {
              const startIso = row.appointment_start_at
              const endIso = row.appointment_end_at ?? row.appointment_start_at
              if (!startIso) return null
              const startD = new Date(startIso)
              const endD = endIso ? new Date(endIso) : new Date(startD.getTime() + 30 * 60 * 1000)
              if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) return null
              let startMin = minutesFromMidnight(startD)
              let endMin = minutesFromMidnight(endD)
              if (endMin <= startMin) endMin = startMin + SLOT_MINUTES
              startMin = Math.max(DAY_START_MIN, startMin)
              endMin = Math.min(DAY_END_MIN, endMin)
              if (endMin <= startMin) return null
              return {
                id: row.id,
                start: startMin,
                end: endMin,
                row,
              }
            })
            .filter((x): x is NonNullable<typeof x> => x != null)

          const laneMeta = assignLanes(intervals.map((x) => ({ id: x.id, start: x.start, end: x.end })))
          const laneCountFor = (id: number) => laneMeta.get(id)?.laneCount ?? 1
          const laneFor = (id: number) => laneMeta.get(id)?.lane ?? 0

          const colBg = col.isOff ? 'bg-red-50/70' : 'bg-white'

          return (
            <div
              key={col.key}
              className={`relative min-w-[132px] max-w-[200px] flex-1 border-l ${col.isOff ? 'border-red-200' : 'border-slate-200'} ${colBg}`}
              style={{ height: gridHeight }}
            >
              {Array.from({ length: totalSlots }, (_, i) => (
                <div
                  key={i}
                  className={`border-b ${col.isOff ? 'border-red-100/80' : 'border-slate-100'}`}
                  style={{ height: SLOT_PX }}
                />
              ))}
              {intervals.map(({ id, start, end, row }) => {
                const top = ((start - DAY_START_MIN) / SLOT_MINUTES) * SLOT_PX
                const height = Math.max(((end - start) / SLOT_MINUTES) * SLOT_PX, SLOT_PX * 0.75)
                const lc = laneCountFor(id)
                const lane = laneFor(id)
                const widthPct = 100 / lc
                const leftPct = lane * widthPct
                const svc = (row.service_names ?? [])[0] ?? ''
                const title = `${row.customer_name} · ${svc}`
                const tone = posAppointmentVisualTone(row.status)

                return (
                  <button
                    key={id}
                    type="button"
                    title={title}
                    onClick={() => onBlockClick(id)}
                    className={posAppointmentDayBlockClass(tone)}
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                    }}
                  >
                    <span className="block truncate font-bold">{formatTimeLabel(row.appointment_start_at)}</span>
                    <span className={posAppointmentDayBlockSubtextClass(tone)}>
                      {truncate(row.customer_name, 14)} · {truncate(svc, 18)}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
