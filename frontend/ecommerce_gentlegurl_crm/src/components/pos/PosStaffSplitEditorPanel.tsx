'use client'

import {
  parseMoneyInput,
  rebalancePrimaryAmountShare,
  rebalancePrimaryPercentShare,
  type StaffSplitDraftRow,
  type StaffSplitMode,
  validateStaffSplitDraft,
} from '@/components/pos/staffSplitCore'

type StaffOption = {
  id: number
  name: string
  email?: string | null
}

type Props = {
  rows: StaffSplitDraftRow[]
  mode: StaffSplitMode
  lineTotal: number | null
  autoBalance: boolean
  allowAmountMode?: boolean
  onModeChange: (mode: StaffSplitMode) => void
  onAutoBalanceChange: (enabled: boolean) => void
  onRowsChange: (rows: StaffSplitDraftRow[]) => void
  onRowSearch: (rowId: string, value: string) => void
  onSelectStaff: (rowId: string, staff: StaffOption) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  getStaffLabel: (staff: StaffOption) => string
  formatMoney?: (value: number) => string
}

export function getStaffSplitDraftValidation(
  rows: StaffSplitDraftRow[],
  mode: StaffSplitMode,
  lineTotal: number | null,
) {
  return validateStaffSplitDraft(
    rows.map((row) => ({
      staff_id: row.staff_id,
      share_percent: row.share_percent,
      share_amount: row.share_amount,
    })),
    mode,
    lineTotal,
  )
}

const SPLIT_MODE_BUTTON_BASE = 'rounded-lg border px-3 py-1.5 text-xs font-semibold'
const SPLIT_MODE_BUTTON_ACTIVE = 'border-indigo-500 bg-indigo-50 text-indigo-700'
const SPLIT_MODE_BUTTON_IDLE = 'border-gray-300 bg-white text-gray-700'
const SPLIT_MODE_BUTTON_DISABLED = 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'

type StaffSplitModeToggleProps = {
  mode: StaffSplitMode
  allowAmountMode: boolean
  /** Show Fixed amount tab (enabled or greyed out). Hide when line has no RM reference. */
  showAmountOption?: boolean
  amountBlockedTitle?: string
  className?: string
  onModeChange: (mode: StaffSplitMode) => void
  onSelectAmount?: () => void
}

/** Percent vs Fixed amount tabs. Package-covered lines show Fixed amount disabled; unclaimed add-ons stay clickable. */
export function StaffSplitModeToggle({
  mode,
  allowAmountMode,
  showAmountOption = true,
  amountBlockedTitle = 'Package-covered line — use percent split (redemption value).',
  className = 'flex flex-wrap gap-2',
  onModeChange,
  onSelectAmount,
}: StaffSplitModeToggleProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onModeChange('percent')}
        className={`${SPLIT_MODE_BUTTON_BASE} ${mode === 'percent' ? SPLIT_MODE_BUTTON_ACTIVE : SPLIT_MODE_BUTTON_IDLE}`}
      >
        Percent (%)
      </button>
      {showAmountOption ? (
        <button
          type="button"
          disabled={!allowAmountMode}
          title={!allowAmountMode ? amountBlockedTitle : undefined}
          onClick={() => {
            if (!allowAmountMode) return
            if (onSelectAmount) {
              onSelectAmount()
            } else {
              onModeChange('amount')
            }
          }}
          className={`${SPLIT_MODE_BUTTON_BASE} ${
            !allowAmountMode
              ? SPLIT_MODE_BUTTON_DISABLED
              : mode === 'amount'
                ? SPLIT_MODE_BUTTON_ACTIVE
                : SPLIT_MODE_BUTTON_IDLE
          }`}
        >
          Fixed amount (RM)
        </button>
      ) : null}
    </div>
  )
}

export default function PosStaffSplitEditorPanel({
  rows,
  mode,
  lineTotal,
  autoBalance,
  allowAmountMode = true,
  onModeChange,
  onAutoBalanceChange,
  onRowsChange,
  onRowSearch,
  onSelectStaff,
  onAddRow,
  onRemoveRow,
  getStaffLabel,
  formatMoney = (value) => value.toFixed(2),
}: Props) {
  const showAmountOption = lineTotal != null && lineTotal > 0
  const canUseAmountMode = allowAmountMode && showAmountOption
  const validation = getStaffSplitDraftValidation(rows, mode, lineTotal)
  const percentTotal = rows.reduce((sum, row) => sum + row.share_percent, 0)
  const amountTotal = rows.reduce((sum, row) => sum + parseMoneyInput(row.share_amount), 0)

  const onChangePercent = (rowId: string, index: number, value: number) => {
    const next = rows.map((row) =>
      row.id === rowId ? { ...row, share_percent: Math.max(0, Math.min(100, Math.trunc(value))) } : row,
    )
    if (autoBalance && index === 0) {
      onRowsChange(next)
      return
    }
    if (autoBalance && index > 0) {
      const rebalanced = rebalancePrimaryPercentShare(
        next.map((row) => ({ ...row, share_percent: String(row.share_percent) })),
      ).map((row) => ({
        ...next.find((item) => item.id === row.id)!,
        share_percent: Number.parseInt(row.share_percent, 10),
      }))
      onRowsChange(rebalanced)
      return
    }
    onRowsChange(next)
  }

  const onChangeAmount = (rowId: string, index: number, value: string) => {
    const next = rows.map((row) => (row.id === rowId ? { ...row, share_amount: value } : row))
    if (autoBalance && index === 0) {
      onRowsChange(next)
      return
    }
    if (autoBalance && index > 0 && lineTotal != null) {
      const rebalanced = rebalancePrimaryAmountShare(
        next.map((row) => ({ ...row, share_amount: row.share_amount })),
        lineTotal,
      )
      onRowsChange(
        rebalanced.map((row) => {
          const original = next.find((item) => item.id === row.id)!
          return { ...original, share_amount: row.share_amount }
        }),
      )
      return
    }
    onRowsChange(next)
  }

  return (
    <div className="space-y-3">
      <StaffSplitModeToggle
        mode={mode}
        allowAmountMode={canUseAmountMode}
        showAmountOption={showAmountOption}
        onModeChange={onModeChange}
      />

      {canUseAmountMode && mode === 'amount' && lineTotal != null ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          Line total: <span className="font-bold">{formatMoney(lineTotal)}</span> — split amounts must match exactly.
        </div>
      ) : null}

      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={autoBalance}
          onChange={(event) => onAutoBalanceChange(event.target.checked)}
          className="h-4 w-4"
        />
        Auto Balance
      </label>

      <div className="space-y-3 pr-1">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1.6fr_0.8fr_auto] sm:items-end"
          >
            <div className="relative">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Staff</label>
              <input
                value={row.search}
                onFocus={() =>
                  onRowsChange(rows.map((item) => (item.id === row.id ? { ...item, open: true } : item)))
                }
                onChange={(event) => onRowSearch(row.id, event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                placeholder="Search staff by name / phone / email"
              />
              {row.open ? (
                <div className="absolute z-[230] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5">
                  {row.loading ? (
                    <p className="px-3 py-2 text-xs text-gray-500">Searching...</p>
                  ) : row.options.filter(
                      (staff) =>
                        !rows.some((other) => other.id !== row.id && other.staff_id === staff.id),
                    ).length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">No available staff</p>
                  ) : (
                    row.options
                      .filter((staff) => !rows.some((other) => other.id !== row.id && other.staff_id === staff.id))
                      .map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => onSelectStaff(row.id, staff)}
                          className="block w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <p className="text-xs font-semibold text-gray-900">{getStaffLabel(staff)}</p>
                          {staff.email ? <p className="mt-0.5 text-[11px] text-gray-600">{staff.email}</p> : null}
                        </button>
                      ))
                  )}
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                {mode === 'amount' ? 'Amount (RM)' : 'Share %'}
              </label>
              {mode === 'amount' ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.share_amount}
                  readOnly={autoBalance && index === 0}
                  onChange={(event) => onChangeAmount(row.id, index, event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm read-only:bg-gray-100"
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.share_percent}
                  readOnly={autoBalance && index === 0}
                  onChange={(event) => onChangePercent(row.id, index, Number(event.target.value || 0))}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm read-only:bg-gray-100"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => onRemoveRow(row.id)}
              className="flex h-10 items-center justify-center rounded-lg border border-red-300 px-3 text-red-700 transition-colors hover:bg-red-50"
              title="Remove"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddRow}
        className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-500 bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md active:scale-95"
      >
        Add Staff
      </button>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <span className="text-sm text-gray-700">{mode === 'amount' ? 'Total amount' : 'Total %'}</span>
        <span className={`text-sm font-bold ${validation.valid ? 'text-gray-900' : 'text-red-600'}`}>
          {mode === 'amount' ? formatMoney(amountTotal) : `${percentTotal}%`}
        </span>
      </div>
    </div>
  )
}
