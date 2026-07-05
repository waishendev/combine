'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import PosModalShell from '@/components/pos/PosModalShell'
import {
  applyPoolChanges,
  canUseAtm,
  computeExpectedCash,
  parseCashShiftAmount,
  type CashShiftPoolBalances,
} from '@/lib/cashShiftPools'
import { formatDateTime12Hour } from '@/lib/formatDateTime'

type PosCashShift = {
  id: number
  opening_amount: number
  opening_refill_packet?: number | null
  opening_atm?: number | null
  opened_by_name?: string | null
  opened_staff_id?: number | null
  opened_staff_name?: string | null
  opened_at?: string | null
  closing_amount?: number | null
  closing_withdraw?: number | null
  closing_refill_cash?: number | null
  closed_by_name?: string | null
  closed_staff_id?: number | null
  closed_staff_name?: string | null
  closed_at?: string | null
  status: 'OPEN' | 'CLOSED'
  cash_sales: number
  expected_cash: number
  total_initial_cash: number
  total_withdraw: number
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
  /** When false, skip cash-shift checks and hide the shift status bar. */
  cashShiftRequired?: boolean
  /** Open / close shift modals — POS checkout only; staff can view shift status read-only. */
  canManageCashShift?: boolean
}

type PosCashShiftContextValue = {
  shift: PosCashShift | null
  hasOpenShift: boolean
  cashShiftLoading: boolean
  requireOpenShiftMessage: string
}

const CASH_SHIFT_OPEN_MESSAGE = 'Open a cash shift before creating appointments or processing requests.'
const CASH_SHIFT_WAIT_MESSAGE = 'Cash shift is not open. Please use the admin account to open the shift before creating appointments.'
const EMPTY_POOLS: CashShiftPoolBalances = { total_initial_cash: 0, total_withdraw: 0 }
const PosCashShiftContext = createContext<PosCashShiftContextValue>({
  shift: null,
  hasOpenShift: true,
  cashShiftLoading: false,
  requireOpenShiftMessage: CASH_SHIFT_OPEN_MESSAGE,
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

function normalizePoolBalances(raw: unknown): CashShiftPoolBalances {
  const row = (raw ?? {}) as Partial<CashShiftPoolBalances>
  return {
    total_initial_cash: Number(row.total_initial_cash ?? 0),
    total_withdraw: Number(row.total_withdraw ?? 0),
  }
}

function CarriedPoolCards({
  balances,
  carried,
}: {
  balances: CashShiftPoolBalances
  carried: CashShiftPoolBalances
}) {
  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-blue-700">Total Initial Cash</p>
        <p className="mt-1 text-2xl font-black text-blue-900">{currency(balances.total_initial_cash)}</p>
      </div>
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-violet-700">Total Withdraw</p>
        <p className="mt-1 text-2xl font-black text-violet-900">{currency(balances.total_withdraw)}</p>
      </div>
    </div>
  )
}

export default function PosCashShiftGate({
  children,
  defaultStaffId = null,
  cashShiftRequired = true,
  canManageCashShift = true,
}: PosCashShiftGateProps) {
  const [shift, setShift] = useState<PosCashShift | null>(null)
  const [poolBalances, setPoolBalances] = useState<CashShiftPoolBalances>(EMPTY_POOLS)
  const [closeModalShift, setCloseModalShift] = useState<PosCashShift | null>(null)
  const [cashShiftLoading, setCashShiftLoading] = useState(true)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [openedStaffId, setOpenedStaffId] = useState(defaultStaffId ? String(defaultStaffId) : '')
  const [closedStaffId, setClosedStaffId] = useState(defaultStaffId ? String(defaultStaffId) : '')
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingRefillPacket, setOpeningRefillPacket] = useState('')
  const [openingAtm, setOpeningAtm] = useState('')
  const [closingAmountInput, setClosingAmountInput] = useState('')
  const [closingWithdraw, setClosingWithdraw] = useState('')
  const [closingRefillCash, setClosingRefillCash] = useState('')
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
      setPoolBalances(normalizePoolBalances(json?.data?.pool_balances))
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
    if (!cashShiftRequired) return
    void loadCurrentShift()
    if (canManageCashShift) {
      void loadStaffOptions()
    }
  }, [canManageCashShift, cashShiftRequired, loadCurrentShift, loadStaffOptions])

  useEffect(() => {
    if (!cashShiftRequired || !shift) return
    const refreshShift = () => {
      void loadCurrentShift()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshShift()
    }
    window.addEventListener('focus', refreshShift)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', refreshShift)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [cashShiftRequired, loadCurrentShift, shift])

  const modalShift = closeModalShift ?? shift
  const openAtmAmount = parseCashShiftAmount(openingAtm)
  const openRefillPacketAmount = parseCashShiftAmount(openingRefillPacket)
  const closeWithdrawAmount = parseCashShiftAmount(closingWithdraw)
  const closeRefillCashAmount = parseCashShiftAmount(closingRefillCash)
  const atmInputDisabled = poolBalances.total_withdraw <= 0

  const openPreviewPools = useMemo(
    () => applyPoolChanges(poolBalances, { refillPacket: openRefillPacketAmount, atm: openAtmAmount }),
    [openAtmAmount, openRefillPacketAmount, poolBalances],
  )

  const closePreviewPools = useMemo(
    () => applyPoolChanges(poolBalances, {
      withdraw: closeWithdrawAmount,
      refillCash: closeRefillCashAmount,
    }),
    [closeRefillCashAmount, closeWithdrawAmount, poolBalances],
  )

  const expectedCash = useMemo(() => {
    if (!modalShift) return 0
    return computeExpectedCash({
      opening_amount: modalShift.opening_amount,
      cash_sales: modalShift.cash_sales,
    })
  }, [modalShift])

  const closeDifference = useMemo(() => Number(closingAmountInput || 0) - expectedCash, [closingAmountInput, expectedCash])
  const openStaffMissing = !openedStaffId
  const closeStaffMissing = !closedStaffId
  const hasOpenShift = cashShiftRequired ? Boolean(shift) : true
  const cashShiftOverlayActive = cashShiftRequired && (openShiftModalOpen || closeModalOpen)
  const openAtmInvalid = openAtmAmount > 0 && !canUseAtm(poolBalances, openAtmAmount)
  const closeRefillCashInvalid = closeRefillCashAmount > 0 && closeRefillCashAmount > poolBalances.total_initial_cash

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

  const requireOpenShiftMessage = canManageCashShift ? CASH_SHIFT_OPEN_MESSAGE : CASH_SHIFT_WAIT_MESSAGE

  const contextValue = useMemo<PosCashShiftContextValue>(() => ({
    shift: cashShiftRequired ? shift : null,
    hasOpenShift,
    cashShiftLoading: cashShiftRequired ? cashShiftLoading : false,
    requireOpenShiftMessage: cashShiftRequired ? requireOpenShiftMessage : '',
  }), [cashShiftLoading, cashShiftRequired, hasOpenShift, requireOpenShiftMessage, shift])

  const openShift = async () => {
    const amount = parseCashShiftAmount(openingAmount)
    const refillPacket = openRefillPacketAmount
    const atm = openAtmAmount
    const staffId = Number(openedStaffId)
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('Please select staff opening this cash shift.')
      return
    }
    if (openingAmount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Opening amount must be 0 or greater.')
      return
    }
    if (!canUseAtm(poolBalances, atm)) {
      setError('ATM amount cannot be used when Total Withdraw pool is empty or exceeds the pool balance.')
      return
    }

    setOpening(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opened_staff_id: staffId,
          opening_amount: amount,
          opening_refill_packet: refillPacket > 0 ? refillPacket : null,
          opening_atm: atm > 0 ? atm : null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to open cash shift.')
      const openedShift = (json?.data?.shift ?? null) as PosCashShift | null
      setShift(openedShift)
      setPoolBalances(normalizePoolBalances(json?.data?.pool_balances))
      if (openedShift?.opened_staff_id) setClosedStaffId(String(openedShift.opened_staff_id))
      setOpeningAmount('')
      setOpeningRefillPacket('')
      setOpeningAtm('')
      setOpenShiftModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open cash shift.')
    } finally {
      setOpening(false)
    }
  }

  const closeShift = async () => {
    const amount = Number(closingAmountInput)
    const withdraw = closeWithdrawAmount
    const refillCash = closeRefillCashAmount
    const staffId = Number(closedStaffId)
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('Please select staff closing this cash shift.')
      return
    }
    if (closingAmountInput.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Closing amount must be 0 or greater.')
      return
    }
    if (refillCash > poolBalances.total_initial_cash) {
      setError('Refill cash cannot exceed the Total Initial Cash pool balance.')
      return
    }

    setClosing(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/pos/cash-shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closed_staff_id: staffId,
          closing_amount: amount,
          closing_withdraw: withdraw > 0 ? withdraw : null,
          closing_refill_cash: refillCash > 0 ? refillCash : null,
          remark: remark.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to close cash shift.')
      setShift(null)
      setPoolBalances(normalizePoolBalances(json?.data?.pool_balances))
      setCloseModalShift(null)
      setClosingAmountInput('')
      setClosingWithdraw('')
      setClosingRefillCash('')
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

  const amountInput = (
    value: string,
    onChange: (value: string) => void,
    placeholder = '0.00',
    disabled = false,
  ) => (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
      placeholder={placeholder}
    />
  )

  return (
    <PosCashShiftContext.Provider value={contextValue}>
    <div className="pos-cash-shift-gate-host relative">
      {cashShiftRequired ? (
      <div className="pos-shift-status-bar mb-2 flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {cashShiftLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 shadow-sm">
            Checking current cash shift…
          </div>
        ) : shift ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-sm">
            <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Shift: OPEN</span>
            <span><b>Initial Cash Pool:</b> {currency(shift.total_initial_cash)}</span>
            <span><b>Withdraw Pool:</b> {currency(shift.total_withdraw)}</span>
            <span><b>Opening:</b> {currency(shift.opening_amount)}</span>
            <span><b>Cash Sales:</b> {currency(shift.cash_sales)}</span>
            <span><b>Opened At:</b> {formatDateTime(shift.opened_at)}</span>
            {canManageCashShift ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                void loadCurrentShift().then((currentShift) => {
                  const shiftForClose = currentShift ?? shift
                  if (!shiftForClose) return
                  setCloseModalShift(shiftForClose)
                  setClosingAmountInput(
                    computeExpectedCash({
                      opening_amount: shiftForClose.opening_amount,
                      cash_sales: shiftForClose.cash_sales,
                    }).toFixed(2),
                  )
                  setClosingWithdraw('')
                  setClosingRefillCash('')
                  setClosedStaffId(shiftForClose.opened_staff_id ? String(shiftForClose.opened_staff_id) : (defaultStaffId ? String(defaultStaffId) : ''))
                  setCloseModalOpen(true)
                })
              }}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Close Shift
            </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
              <span><b>Initial Cash Pool:</b> {currency(poolBalances.total_initial_cash)}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span><b>Withdraw Pool:</b> {currency(poolBalances.total_withdraw)}</span>
            </div>
            {canManageCashShift ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setOpeningAmount('0')
                setOpeningRefillPacket('')
                setOpeningAtm('')
                void loadCurrentShift()
                setOpenShiftModalOpen(true)
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              Open Shift
            </button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm">
                Shift closed — Please use admin account to open
              </div>
            )}
          </div>
        )}
      </div>
      ) : null}

      {children}

      {cashShiftRequired && canManageCashShift && openShiftModalOpen ? (
        <PosModalShell
          onClose={() => setOpenShiftModalOpen(false)}
          closeDisabled={opening}
          zIndexClassName="z-[200]"
          overlayClassName="bg-black/55 backdrop-blur-sm"
          size="xl"
          header={(
            <div className="bg-slate-900 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Open Cash Shift</h3>
            </div>
          )}
        >
          <div className="space-y-4 p-6">
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <CarriedPoolCards balances={openPreviewPools} carried={poolBalances} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Staff
                {staffSelect(openedStaffId, setOpenedStaffId, opening)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Opening Amount
                {amountInput(openingAmount, setOpeningAmount, '0.00', opening)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Refill Cash (Packet)
                {amountInput(openingRefillPacket, setOpeningRefillPacket, 'Optional', opening)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                ATM
                {amountInput(openingAtm, setOpeningAtm, atmInputDisabled ? 'Withdraw pool empty' : 'Optional', opening || atmInputDisabled)}
              </label>
            </div>
            {atmInputDisabled ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                ATM is disabled because Total Withdraw pool is empty. Close a shift with Withdraw first.
              </p>
            ) : null}
            {openAtmInvalid ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                ATM amount cannot exceed the current Total Withdraw pool ({currency(poolBalances.total_withdraw)}).
              </p>
            ) : null}
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
                disabled={staffLoading || openStaffMissing || opening || openAtmInvalid}
                className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opening ? 'Opening…' : 'Confirm Open Shift'}
              </button>
            </div>
          </div>
        </PosModalShell>
      ) : null}

      {cashShiftRequired && canManageCashShift && closeModalOpen && modalShift ? (
        <PosModalShell
          onClose={() => {
            setCloseModalOpen(false)
            setCloseModalShift(null)
          }}
          closeDisabled={closing}
          zIndexClassName="z-[210]"
          overlayClassName="bg-black/55 backdrop-blur-sm"
          size="xl"
          header={(
            <div className="bg-red-700 px-6 py-5 text-white">
              <h3 className="text-xl font-black">Close Cash Shift</h3>
              <p className="mt-1 text-sm text-red-100">Count the drawer and enter the close cash amount.</p>
            </div>
          )}
        >
          <div className="space-y-4 p-6">
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <CarriedPoolCards
              balances={closePreviewPools}
              carried={{
                total_initial_cash: poolBalances.total_initial_cash,
                total_withdraw: poolBalances.total_withdraw,
              }}
            />
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Opened Staff</p><p className="font-bold">{modalShift.opened_staff_name ?? '—'}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Opening Amount</p><p className="font-bold">{currency(modalShift.opening_amount)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Cash Sales</p><p className="font-bold">{currency(modalShift.cash_sales)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-gray-500">Expected Cash</p><p className="font-bold">{currency(expectedCash)}</p></div>
              <div className={`rounded-xl p-3 md:col-span-2 ${closeDifference < 0 ? 'bg-red-50' : closeDifference > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className="text-gray-500">Difference Preview</p><p className="font-bold">{currency(closeDifference)}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Closing Staff
                {staffSelect(closedStaffId, setClosedStaffId, closing)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Closing Amount
                {amountInput(closingAmountInput, setClosingAmountInput, '0.00', closing)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Withdraw
                {amountInput(closingWithdraw, setClosingWithdraw, 'Optional', closing)}
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Refill Cash
                {amountInput(closingRefillCash, setClosingRefillCash, 'Optional', closing)}
              </label>
            </div>
            {closeRefillCashInvalid ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                Refill cash cannot exceed the current Total Initial Cash pool ({currency(poolBalances.total_initial_cash)}).
              </p>
            ) : null}
            <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
              Remark (optional)
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCloseModalOpen(false)} disabled={closing} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void closeShift()} disabled={staffLoading || closeStaffMissing || closing || closeRefillCashInvalid} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{closing ? 'Closing…' : 'Confirm Close'}</button>
            </div>
          </div>
        </PosModalShell>
      ) : null}
    </div>
    </PosCashShiftContext.Provider>
  )
}
