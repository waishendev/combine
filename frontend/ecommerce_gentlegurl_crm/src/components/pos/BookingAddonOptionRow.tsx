'use client'

import type { ReactNode } from 'react'

import {
  ADDON_QTY_MAX,
  ADDON_QTY_MIN,
  addonAllowsQuantity,
  clampAddonQuantity,
  formatSelectedAddonDurationText,
  getAddonQuantity,
  isAddonSelected,
  storedAddonQuantity,
  type AddonSelectionMap,
  type BookingAddonOptionLike,
} from '@/components/pos/bookingAddonQuantity'
import {
  formatPosCurrentOrRangeDisplay,
  formatPosPriceDisplay,
  posAddonDisplayWithSelection,
  posAddonPriceIsFinalized,
  posPriceDisplayHasFinalPrice,
  posPriceDisplayHasRange,
  type PosPriceDisplaySource,
} from '@/components/pos/settlementAmountUtils'

function AddonOptionNameStack({
  name,
  cnName,
  primaryClassName,
  secondaryClassName,
}: {
  name: string
  cnName?: string | null
  primaryClassName: string
  secondaryClassName: string
}) {
  return (
    <div className="min-w-0">
      <p className={primaryClassName}>{name || '—'}</p>
      {cnName ? <p className={secondaryClassName}>{cnName}</p> : null}
    </div>
  )
}

function AddonQuantityStepper({
  quantity,
  onQuantityChange,
}: {
  quantity: number
  onQuantityChange: (qty: number) => void
}) {
  return (
    <div
      className="inline-flex items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      onClick={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={quantity <= ADDON_QTY_MIN}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onQuantityChange(clampAddonQuantity(quantity - 1, true))
        }}
        className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        min={ADDON_QTY_MIN}
        max={ADDON_QTY_MAX}
        value={quantity}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation()
          onQuantityChange(clampAddonQuantity(Number(event.target.value), true))
        }}
        className="h-8 w-10 border-x border-gray-200 bg-gray-50/80 text-center text-xs font-bold tabular-nums text-gray-900 focus:outline-none focus:ring-0"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={quantity >= ADDON_QTY_MAX}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onQuantityChange(clampAddonQuantity(quantity + 1, true))
        }}
        className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        +
      </button>
    </div>
  )
}

export function PosAddonSelectionDurationLabel({
  option,
  selection,
  prefix = 'TIME: ',
}: {
  option: BookingAddonOptionLike
  selection: AddonSelectionMap
  prefix?: string
}) {
  const text = formatSelectedAddonDurationText(option, selection, prefix)
  if (!text) return null
  return <>{text}</>
}

export function PosAddonSelectionPriceLabel({
  option,
  selection,
  useRangeDisplay = false,
  overrideAmount,
  hasOverrideKey,
  prefix = '+',
}: {
  option: PosPriceDisplaySource & BookingAddonOptionLike & { label?: string }
  selection: AddonSelectionMap
  useRangeDisplay?: boolean
  overrideAmount?: number
  hasOverrideKey?: boolean
  prefix?: string
}) {
  const display = posAddonDisplayWithSelection(option, selection, overrideAmount, hasOverrideKey)
  const priceText = useRangeDisplay
    ? formatPosCurrentOrRangeDisplay(display, { prefix: 'RM' })
    : formatPosPriceDisplay(display, { prefix: 'RM' })
  return <>{prefix}{priceText}</>
}

/** Edit Settlement add-on row: shows line total (unit × qty), including range pricing scaled by quantity. */
export function PosAddonSettlementPriceLabel({
  option,
  selection,
  useRangeDisplay = false,
  overrideAmount,
  hasOverrideKey,
  lineTotalOverride,
  hasLineTotalOverrideKey,
  emphasis = false,
}: {
  option: PosPriceDisplaySource & BookingAddonOptionLike & { label?: string }
  selection: AddonSelectionMap
  useRangeDisplay?: boolean
  overrideAmount?: number
  hasOverrideKey?: boolean
  lineTotalOverride?: number
  hasLineTotalOverrideKey?: boolean
  emphasis?: boolean
}) {
  const optionId = Number(option.id ?? 0)
  const qty = getAddonQuantity(selection, optionId)
  const selected = qty > 0

  if (!selected) {
    if (useRangeDisplay && posPriceDisplayHasRange(option)) {
      return <span className={`tabular-nums ${emphasis ? 'text-sm font-bold text-gray-800' : 'text-xs font-semibold text-gray-700'}`}>+{formatPosPriceDisplay(option, { prefix: 'RM' })}</span>
    }
    return <span className={`tabular-nums ${emphasis ? 'text-sm font-bold text-gray-800' : 'text-xs font-semibold text-gray-900'}`}>+RM {Number(option.extra_price ?? 0).toFixed(2)}</span>
  }

  const lineDisplay = posAddonDisplayWithSelection(
    option,
    selection,
    overrideAmount,
    hasOverrideKey,
    lineTotalOverride,
    hasLineTotalOverrideKey,
  )
  const rangeActive = useRangeDisplay
    && lineDisplay
    && posPriceDisplayHasRange(lineDisplay)
    && !posPriceDisplayHasFinalPrice(lineDisplay)
    && !(hasOverrideKey && posAddonPriceIsFinalized(option, overrideAmount, hasOverrideKey))

  const priceText = rangeActive
    ? formatPosCurrentOrRangeDisplay(lineDisplay, { prefix: 'RM' })
    : formatPosPriceDisplay(
        lineDisplay
          ? { ...lineDisplay, price_mode: null, service_price_mode: null, linked_price_mode: null }
          : lineDisplay,
        { prefix: 'RM' },
      )

  return (
    <span className={`tabular-nums ${emphasis ? 'text-sm font-bold text-indigo-950' : 'text-xs font-bold text-gray-900'}`}>+{priceText}</span>
  )
}

export function PosAddonLineName({
  name,
  cnName,
  quantity,
  prefix = '+ ',
  layout = 'inline',
  quantityClassName = 'font-semibold tabular-nums text-gray-600',
  cnClassName = 'block pl-2 text-[10px] text-gray-500',
  trailing,
}: {
  name: string
  cnName?: string | null
  quantity?: number | null
  prefix?: string
  layout?: 'inline' | 'stacked'
  quantityClassName?: string
  cnClassName?: string
  trailing?: ReactNode
}) {
  const qty = storedAddonQuantity({ quantity })

  if (layout === 'stacked') {
    return (
      <div className="min-w-0 leading-snug">
        <span className="block font-medium text-slate-800">{prefix}{name}</span>
        {cnName ? <span className={cnClassName}>{cnName}</span> : null}
        {qty > 1 ? <span className={`block ${quantityClassName}`}>× {qty}</span> : null}
        {trailing}
      </div>
    )
  }

  return (
    <>
      <span>
        {prefix}
        {name}
        {qty > 1 ? <span className={quantityClassName}> × {qty}</span> : null}
      </span>
      {cnName ? <span className={cnClassName}>{cnName}</span> : null}
      {trailing}
    </>
  )
}

type BookingAddonOptionRowProps = {
  option: BookingAddonOptionLike & {
    label: string
    cn_label?: string | null
    cn_name?: string | null
    linked_cn_name?: string | null
  } & PosPriceDisplaySource
  selection: AddonSelectionMap
  onToggle: () => void
  onQuantityChange: (qty: number) => void
  priceLabel: ReactNode
  durationLabel?: ReactNode
  trailing?: ReactNode
  variant?: 'plain' | 'card' | 'settlement'
}

export default function BookingAddonOptionRow({
  option,
  selection,
  onToggle,
  onQuantityChange,
  priceLabel,
  durationLabel,
  trailing,
  variant = 'plain',
}: BookingAddonOptionRowProps) {
  const checked = isAddonSelected(selection, option.id)
  const allowQuantity = addonAllowsQuantity(option)
  const quantity = checked ? getAddonQuantity(selection, option.id) : ADDON_QTY_MIN

  if (variant === 'settlement') {
    return (
      <div
        className={`rounded-xl border transition-all ${
          checked
            ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-violet-50/40 shadow-sm ring-1 ring-indigo-100'
            : 'border-gray-200 bg-gray-50/60 hover:border-gray-300 hover:bg-white'
        }`}
      >
        <div className="flex items-start gap-3 p-3.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />

          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{option.label}</p>
              {option.cn_label ?? option.cn_name ?? option.linked_cn_name ? (
                <p className="mt-0.5 text-[11px] text-gray-500">{option.cn_label ?? option.cn_name ?? option.linked_cn_name}</p>
              ) : null}
              {durationLabel ? (
                <span className="mt-1.5 inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-600 tabular-nums ring-1 ring-gray-200">
                  {durationLabel}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 tabular-nums ${
                checked
                  ? 'border border-indigo-200 bg-white text-indigo-950 shadow-sm'
                  : 'border border-gray-200 bg-white/80 text-gray-700'
              }`}>
                {priceLabel}
              </span>
              {checked && allowQuantity ? (
                <AddonQuantityStepper quantity={quantity} onQuantityChange={onQuantityChange} />
              ) : null}
            </div>
          </div>
        </div>

        {checked && trailing ? (
          <div className="border-t border-indigo-100/80 bg-white/50 px-3.5 py-3">
            {trailing}
          </div>
        ) : null}
      </div>
    )
  }

  const containerClass =
    variant === 'card'
      ? `flex cursor-pointer items-center justify-between rounded-lg border-2 px-3 py-2.5 transition-all ${
          checked ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:border-gray-300'
        }`
      : 'flex cursor-pointer items-center justify-between gap-3 text-sm text-gray-800'

  return (
    <label className={containerClass}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div className="min-w-0 flex-1">
          <AddonOptionNameStack
            name={option.label}
            cnName={option.cn_label ?? option.cn_name ?? option.linked_cn_name}
            primaryClassName={variant === 'card' ? 'text-sm font-medium text-gray-900' : 'block truncate font-medium text-gray-900'}
            secondaryClassName={variant === 'card' ? 'mt-0.5 text-[11px] text-gray-500' : 'mt-0.5 block truncate text-[11px] font-normal text-gray-500'}
          />
          {durationLabel ? (
            <span className="mt-0.5 block text-[11px] font-semibold text-gray-600 tabular-nums">{durationLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 pl-2">
        <span className={`tabular-nums font-semibold ${variant === 'card' ? 'text-xs text-gray-600' : 'text-gray-900'}`}>
          {priceLabel}
        </span>
        {checked && allowQuantity ? (
          <AddonQuantityStepper quantity={quantity} onQuantityChange={onQuantityChange} />
        ) : null}
        {checked ? trailing : null}
      </div>
    </label>
  )
}
