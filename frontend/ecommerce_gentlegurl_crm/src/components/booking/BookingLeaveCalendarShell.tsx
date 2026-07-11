'use client'

import { useCallback, useEffect, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import BookingLeaveCalendarPage from '@/components/booking/BookingLeaveCalendarPage'
import BookingLeaveRequestsPage from '@/components/booking/BookingLeaveRequestsPage'

type BookingLeaveCalendarShellProps = {
  permissions: string[]
}

const extractPendingTotal = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0
  const root = payload as {
    data?: unknown
    meta?: { total?: number }
  }

  if (root.meta && typeof root.meta.total === 'number') {
    return root.meta.total
  }

  if (Array.isArray(root.data)) {
    return root.data.length
  }

  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const nested = root.data as { data?: unknown; total?: number }
    if (typeof nested.total === 'number') return nested.total
    if (Array.isArray(nested.data)) return nested.data.length
  }

  return 0
}

export default function BookingLeaveCalendarShell({ permissions }: BookingLeaveCalendarShellProps) {
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)

  const loadPendingCount = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      qs.set('status', 'pending')
      qs.set('per_page', '1')
      const res = await fetch(`/api/proxy/admin/booking/leave-requests?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        setPendingCount(null)
        return
      }
      const payload = await res.json().catch(() => ({}))
      setPendingCount(extractPendingTotal(payload))
    } catch {
      setPendingCount(null)
    }
  }, [])

  useEffect(() => {
    void loadPendingCount()
  }, [loadPendingCount])

  const openRequestsModal = () => {
    setRequestsRefreshKey((key) => key + 1)
    setIsRequestsModalOpen(true)
  }

  const closeRequestsModal = () => {
    setIsRequestsModalOpen(false)
    setCalendarRefreshKey((key) => key + 1)
    void loadPendingCount()
  }

  const handleDecisionComplete = () => {
    void loadPendingCount()
    setCalendarRefreshKey((key) => key + 1)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold sm:text-3xl">Leave Calendar</h2>
          <p className="mt-1.5 hidden text-sm text-slate-600 sm:block">
            View leave on the calendar. Open Requests to review pending leave and day-change applications.
          </p>
        </div>

        <button
          type="button"
          onClick={openRequestsModal}
          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-100 sm:w-auto sm:min-h-0 sm:rounded-lg sm:py-2.5"
        >
          <i className="fa-solid fa-inbox" />
          Pending Requests
          {pendingCount !== null && pendingCount > 0 ? (
            <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          ) : null}
        </button>
      </div>

      <BookingLeaveCalendarPage key={calendarRefreshKey} permissions={permissions} />

      {isRequestsModalOpen && (
        <CrmFormModalShell
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              Leave Requests
              {pendingCount !== null && pendingCount > 0 ? (
                <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                  {pendingCount} pending
                </span>
              ) : null}
            </span>
          }
          size="xl"
          onClose={closeRequestsModal}
        >
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            <p className="mb-3 text-xs leading-relaxed text-slate-600 sm:mb-4 sm:text-sm">
              Swipe-friendly list below. Tap Review to approve or reject — the calendar refreshes when you close this
              window.
            </p>
            <BookingLeaveRequestsPage
              key={requestsRefreshKey}
              onDecisionComplete={handleDecisionComplete}
            />
          </div>
        </CrmFormModalShell>
      )}
    </div>
  )
}
