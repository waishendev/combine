'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import PosModalShell from '@/components/pos/PosModalShell'
import { formatDateTime12Hour } from '@/lib/formatDateTime'

type PosCashShift = {
  id: number
  opening_amount: number
  opened_by_name?: string | null
  opened_staff_id?: number | null
  opened_staff_name?: string | null
  opened_at?: string | null
  closing_amount?: number | null
  closed_by_name?: string | null
  closed_staff_id?: number | null
  closed_staff_name?: string | null
  closed_at?: string | null
  status: 'OPEN' | 'CLOSED'
  cash_sales: number
  expected_cash: number
  difference?: number | null
}

type StaffOption = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  is_active?: boolean | number | string | null
}

type PosCashShiftGateProps = {
  children: ReactNode
  defaultStaffId?: number | null
}

type PosCashShiftContextValue = {
  shift: PosCashShift | null
  hasOpenShift: boolean
  cashShiftLoading: boolean
  requireOpenShiftMessage: string
}

const CASH_SHIFT_REQUIRED_MESSAGE = ''
const PosCashShiftContext = createContext<PosCashShiftContextValue>({
  shift: null,
  hasOpenShift: true,
  cashShiftLoading: false,
  requireOpenShiftMessage: CASH_SHIFT_REQUIRED_MESSAGE,
})

export function usePosCashShift() {
  return useContext(PosCashShiftContext)
}

const currency = (value: number | null | undefined) => `RM ${Number(value ?? 0).toFixed(2)}`
const formatDateTime = (value?: string | null) => formatDateTime12Hour(value) || '—'

function normalizeStaffOptions(raw: unknown): StaffOption[] {
  const list: unknown[] = Array.isArray(raw) ? raw : []
  return list
    .map((item): StaffOption | null => {
      const row = item as Partial<StaffOption>
      const id = Number(row.id)
      if (!Number.isFinite(id) || id <= 0) return null
      return {
        id,
        name: row.name ? String(row.name) : `Staff #${id}`,
        email: row.email ?? null,
        phone: row.phone ?? null,
        is_active: row.is_active ?? null,
      }
    })
    .filter((item): item is StaffOption => item !== null)
    .filter((item) => item.is_active === null || item.is_active === undefined || item.is_active === true || item.is_active === 1 || item.is_active === '1')
}

export default function PosCashShiftGate({ children, defaultStaffId = null }: PosCashShiftGateProps) {
  const [shift, setShift] = useState<PosCashShift | null>(null)
  const [cashShiftLoading, setCashShiftLoading] = useState(true)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [openedStaffId, setOpenedStaffId] = useState(defaultStaffId ? String(defaultStaffId) : '')
  const [closedStaffId, setClosedStaffId] = useState(defaultStaffId ? String(defaultStaffId) : '')
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmountInput, setClosingAmountInput] = useState('')
  const [remark, setRemark] = useState('')
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStaffOptions = useCallback(async () => {
    setStaffLoading(true)
    try {
      const res = await fetch('/api/proxy/staffs?page=1&per_page=100', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load staff list.')
      const options = normalizeStaffOptions(json?.data?.data ?? json?.data ?? [])
      setStaffOptions(options)
      setOpenedStaffId((current) => current || (defaultStaffId ? String(defaultStaffId) : ''))
      setClosedStaffId((current) => current || (defaultStaffId ? String(defaultStaffId) : ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load staff list.')
    } finally {
      setStaffLoading(false)
    }
  }, [defaultStaffId])

  const loadCurrentShift = useCallback(async () => {
    setCashShiftLoading(true)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/current', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to check current cash shift.')
      const currentShift = (json?.data?.shift ?? null) as PosCashShift | null
      setShift(currentShift)
      if (currentShift?.opened_staff_id) {
        setClosedStaffId(String(currentShift.opened_staff_id))
      }
      return currentShift
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check current cash shift.')
      return null
    } finally {
      setCashShiftLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStaffOptions()
    void loadCurrentShift()
  }, [loadCurrentShift, loadStaffOptions])

  const expectedCash = Number(shift?.expected_cash ?? 0)
  const closeDifference = useMemo(() => Number(closingAmountInput || 0) - expectedCash, [closingAmountInput, expectedCash])
  const openStaffMissing = !openedStaffId
  const closeStaffMissing = !closedStaffId
  const hasOpenShift = Boolean(shift)
  const cashShiftOverlayActive = openShiftModalOpen || closeModalOpen

  useEffect(() => {
    if (cashShiftOverlayActive) {
      document.body.dataset.posCashShiftModalOpen = 'true'
    } else {
      delete document.body.dataset.posCashShiftModalOpen
    }

    return () => {
      delete document.body.dataset.posCashShiftModalOpen
    }
  }, [cashShiftOverlayActive])

  const contextValue = useMemo<PosCashShiftContextValue>(() => ({
    shift,
    hasOpenShift,
    cashShiftLoading,
    requireOpenShiftMessage: CASH_SHIFT_REQUIRED_MESSAGE,
  }), [cashShiftLoading, hasOpenShift, shift])

  const openShift = async () => {
    const amount = Number(openingAmount)
    const staffId = Number(openedStaffId)
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('Please select staff opening this cash shift.')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Opening amount must be 0 or greater.')
      return
    }

    setOpening(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opened_staff_id: staffId, opening_amount: amount }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to open cash shift.')
      const openedShift = (json?.data?.shift ?? null) as PosCashShift | null
      setShift(openedShift)
      if (openedShift?.opened_staff_id) setClosedStaffId(String(openedShift.opened_staff_id))
      setOpeningAmount('')
      setOpenShiftModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open cash shift.')
    } finally {
      setOpening(false)
    }
  }

  const closeShift = async () => {
    const amount = Number(closingAmountInput)
    const staffId = Number(closedStaffId)
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('Please select staff closing this cash shift.')
      return
    }
    if (closingAmountInput.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Closing amount must be 0 or greater.')
      return
    }

    setClosing(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_staff_id: staffId, closing_amount: amount, remark: remark.trim() || null }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to close cash shift.')
      setShift(null)
      setClosingAmountInput('')
      setRemark('')
      setCloseModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close cash shift.')
    } finally {
      setClosing(false)
    }
  }

  const staffSelect = (
    value: string,
    onChange: (value: string) => void,
    disabled = false,
  ) => (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || staffLoading}
      className="mt-1 h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
    >
      <option value="">{staffLoading ? 'Loading staff…' : 'Select staff'}</option>
      {staffOptions.map((staff) => (
        <option key={staff.id} value={staff.id}>
          {staff.name}{staff.phone ? ` · ${staff.phone}` : ''}
        </option>
      ))}
    </select>
  )

  return (
    <PosCashShiftContext.Provider value={contextValue}>
    <div className="pos-cash-shift-gate-host relative">
      <div className="pos-shift-status-bar mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {cashShiftLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 shadow-sm">
            Checking current cash shift…
          </div>
        ) : shift ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm">
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Current Shift: OPEN</span>
            <span><b>Staff:</b> {shift.opened_staff_name ?? '—'}</span>
            <span><b>Opening:</b> {currency(shift.opening_amount)}</span>
            <span><b>Opened At:</b> {formatDateTime(shift.opened_at)}</span>
            <button
              type="button"
              onClick={() => {
                setError(null)
                void loadCurrentShift().then((currentShift) => {
                  const shiftForClose = currentShift ?? shift
                  setClosingAmountInput(Number(shiftForClose.expected_cash ?? 0).toFixed(2))
                  setClosedStaffId(shiftForClose.opened_staff_id ? String(shiftForClose.opened_staff_id) : (defaultStaffId ? String(defaultStaffId) : ''))
                  setCloseModalOpen(true)
                })
              }}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Close Shift
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setOpenShiftModalOpen(true)
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            Open Shift
          </button>
        )}
      </div>

      {children}

      {openShiftModalOpen ? (
        <PosModalShell
          onClose={() => setOpenShiftModalOpen(false)}
          closeDisabled={opening}
          zIndexClassName="z-[200]"
          overlayClassName="bg-black/55 backdrop-blur-sm"
          size="sm"
          header={(
            <div className="bg-slate-900 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Open Cash Shift</h3>
              <p className="mt-1 text-sm text-slate-200">Open a cash drawer shift before using POS.</p>
            </div>
          )}
        >
          <div className="space-y-4 p-6">
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <label className="block text-sm font-semibold text-gray-700">
              Staff
              {staffSelect(openedStaffId, setOpenedStaffId, opening)}
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Opening Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="0.00"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenShiftModalOpen(false)}
                disabled={opening}
                className="h-11 flex-1 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void openShift()}
                disabled={staffLoading || openStaffMissing || opening}
                className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opening ? 'Opening…' : 'Confirm Open Shift'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Open a shift when you are ready to perform checkout or operational payment actions.</p>
          </div>
        </PosModalShell>
      ) : null}

      {closeModalOpen && shift ? (
        <PosModalShell
          onClose={() => setCloseModalOpen(false)}
          closeDisabled={closing}
          zIndexClassName="z-[210]"
          overlayClassName="bg-black/55 backdrop-blur-sm"
          size="md"
          header={(
            <div className="bg-red-700 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Close Cash Shift</h3>
              <p className="mt-1 text-sm text-red-100">Count the drawer and enter the close cash amount.</p>
            </div>
          )}
        >
          <div className="space-y-4 p-6">
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Opened Staff</p><p className="font-bold">{shift.opened_staff_name ?? '—'}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Opening Amount</p><p className="font-bold">{currency(shift.opening_amount)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Cash Sales</p><p className="font-bold">{currency(shift.cash_sales)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Expected Cash</p><p className="font-bold">{currency(shift.expected_cash)}</p></div>
              <div className={`rounded-xl p-3 ${closeDifference < 0 ? 'bg-red-50' : closeDifference > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className="text-gray-500">Difference Preview</p><p className="font-bold">{currency(closeDifference)}</p></div>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              Closing Staff
              {staffSelect(closedStaffId, setClosedStaffId, closing)}
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Closing Amount
              <input
                type="text"
                inputMode="decimal"
                value={closingAmountInput}
                onChange={(event) => setClosingAmountInput(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Remark (optional)
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCloseModalOpen(false)} disabled={closing} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void closeShift()} disabled={staffLoading || closeStaffMissing || closing} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{closing ? 'Closing…' : 'Confirm Close'}</button>
            </div>
          </div>
        </PosModalShell>
      ) : null}
    </div>
    </PosCashShiftContext.Provider>
  )
}
