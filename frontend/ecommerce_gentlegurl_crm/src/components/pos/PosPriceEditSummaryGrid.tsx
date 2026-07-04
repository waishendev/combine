'use client'

import {
  formatPosPriceDisplay,
  posPriceDisplayForAddonLine,
  posPriceDisplayHasFinalPrice,
  posPriceDisplayHasRange,
  type PosPriceDisplaySource,
} from '@/components/pos/settlementAmountUtils'

export function resolvePriceEditQuantity(quantity?: number | null): number {
  const qty = Number(quantity ?? 1)
  return Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1
}

function normalizeAddonLinePriceSource(
  priceSource: PosPriceDisplaySource,
  quantity: number,
  extraPrice?: number,
) {
  return {
    ...priceSource,
    quantity,
    extra_price: extraPrice ?? Number(priceSource.extra_price ?? 0),
  }
}

export function priceEditTargetUsesQuantityBreakdown(kind: string, quantity?: number | null): boolean {
  if (['originalAddon', 'addedAddon', 'createMainAddon', 'createBlockAddon', 'cartEditSettlementAddon', 'cartEditSettlementBlockAddon', 'bookingMainAddon', 'bookingBlockAddon'].includes(kind)) {
    return true
  }
  return resolvePriceEditQuantity(quantity) > 1
}

export function formatPriceEditOriginalUnitDisplay(
  priceSource: PosPriceDisplaySource | null | undefined,
  originalUnitPrice: number,
): string {
  if (priceSource && posPriceDisplayHasRange(priceSource)) {
    return formatPosPriceDisplay(priceSource)
  }
  return `RM ${Number(originalUnitPrice ?? 0).toFixed(2)}`
}

export function formatPriceEditOriginalLineTotalDisplay(
  priceSource: PosPriceDisplaySource | null | undefined,
  originalUnitPrice: number,
  quantity?: number | null,
): string {
  const qty = resolvePriceEditQuantity(quantity)
  if (priceSource && posPriceDisplayHasRange(priceSource)) {
    const scale = (value: number | string | null | undefined) => {
      const parsed = Number(value ?? NaN)
      return Number.isFinite(parsed) ? parsed * qty : value
    }
    return formatPosPriceDisplay({
      ...priceSource,
      price_range_min: scale(priceSource.price_range_min ?? priceSource.service_price_range_min ?? priceSource.linked_price_range_min),
      price_range_max: scale(priceSource.price_range_max ?? priceSource.service_price_range_max ?? priceSource.linked_price_range_max),
      service_price_range_min: scale(priceSource.service_price_range_min),
      service_price_range_max: scale(priceSource.service_price_range_max),
      linked_price_range_min: scale(priceSource.linked_price_range_min),
      linked_price_range_max: scale(priceSource.linked_price_range_max),
    })
  }
  return `RM ${(Number(originalUnitPrice ?? 0) * qty).toFixed(2)}`
}

export function formatPriceEditCurrentCombinedDisplay(
  priceSource: PosPriceDisplaySource | null | undefined,
  currentUnitPrice: number,
  quantity?: number | null,
  lineTotalOverride?: number | null,
  hasLineTotalOverrideKey?: boolean,
): string {
  const qty = resolvePriceEditQuantity(quantity)
  if (hasLineTotalOverrideKey && lineTotalOverride != null && Number.isFinite(Number(lineTotalOverride))) {
    return `RM ${Number(lineTotalOverride).toFixed(2)}`
  }
  const rangeUnsettled = priceSource && posPriceDisplayHasRange(priceSource) && !posPriceDisplayHasFinalPrice(priceSource)

  if (priceSource) {
    const lineSource = posPriceDisplayForAddonLine(
      normalizeAddonLinePriceSource(
        priceSource,
        qty,
        posPriceDisplayHasFinalPrice(priceSource) ? currentUnitPrice : undefined,
      ),
    )
    if (lineSource && rangeUnsettled) {
      return formatPosPriceDisplay(lineSource)
    }
  }

  const total = Number(currentUnitPrice ?? 0) * qty
  if (rangeUnsettled && total <= 0) {
    return priceSource
      ? formatPosPriceDisplay(
        posPriceDisplayForAddonLine(normalizeAddonLinePriceSource(priceSource, qty)) ?? priceSource,
      )
      : 'Not set'
  }
  return `RM ${total.toFixed(2)}`
}

type SummaryTone = 'reference' | 'current' | 'quantity'

const SUMMARY_SECTION_STYLES: Record<SummaryTone, { box: string; label: string; value: string }> = {
  reference: {
    box: 'border-2 border-slate-300 bg-slate-100',
    label: 'text-slate-600',
    value: 'text-sm font-semibold text-slate-800',
  },
  current: {
    box: 'border-2 border-blue-400 bg-blue-100 shadow-md ring-1 ring-blue-200',
    label: 'text-blue-800',
    value: 'text-base font-bold text-blue-950',
  },
  quantity: {
    box: 'border-2 border-violet-300 bg-violet-50',
    label: 'text-violet-700',
    value: 'text-base font-bold tabular-nums text-violet-950',
  },
}

function SummarySection({
  tone,
  children,
}: {
  tone: SummaryTone
  children: React.ReactNode
}) {
  const styles = SUMMARY_SECTION_STYLES[tone]
  return (
    <div className={`rounded-xl p-3.5 ${styles.box}`}>
      {children}
    </div>
  )
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: SummaryTone
}) {
  const styles = SUMMARY_SECTION_STYLES[tone]
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${styles.label}`}>{label}</p>
      <p className={`mt-1 tabular-nums ${styles.value}`}>{value}</p>
    </div>
  )
}

function QuantityBreakdownSummary({
  originalUnitDisplay,
  originalLineTotalDisplay,
  currentUnitDisplay,
  currentLineTotalDisplay,
  quantity,
}: {
  originalUnitDisplay: string
  originalLineTotalDisplay: string
  currentUnitDisplay: string
  currentLineTotalDisplay: string
  quantity: number
}) {
  return (
    <div className="mt-4 space-y-3 text-sm">
      <SummarySection tone="reference">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell tone="reference" label="Original Unit Price" value={originalUnitDisplay} />
          <SummaryCell tone="reference" label="Original Line Total" value={originalLineTotalDisplay} />
        </div>
      </SummarySection>

      <SummarySection tone="current">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell tone="current" label="Current Unit Price" value={currentUnitDisplay} />
          <SummaryCell tone="current" label="Current Line Total" value={currentLineTotalDisplay} />
        </div>
      </SummarySection>

      <SummarySection tone="quantity">
        <SummaryCell tone="quantity" label="Quantity" value={String(quantity)} />
      </SummarySection>
    </div>
  )
}

type PosPriceEditSummaryGridProps = {
  kind: string
  originalUnitPrice: number
  currentUnitPrice: number
  quantity?: number | null
  priceSource?: PosPriceDisplaySource | null
  lineTotalOverride?: number | null
  hasLineTotalOverrideKey?: boolean
}

export default function PosPriceEditSummaryGrid({
  kind,
  originalUnitPrice,
  currentUnitPrice,
  quantity,
  priceSource,
  lineTotalOverride,
  hasLineTotalOverrideKey,
}: PosPriceEditSummaryGridProps) {
  const qty = resolvePriceEditQuantity(quantity)
  const showBreakdown = priceEditTargetUsesQuantityBreakdown(kind, qty)
  const originalUnitDisplay = formatPriceEditOriginalUnitDisplay(priceSource, originalUnitPrice)
  const originalLineTotalDisplay = formatPriceEditOriginalLineTotalDisplay(priceSource, originalUnitPrice, qty)
  const currentLineTotalDisplay = formatPriceEditCurrentCombinedDisplay(
    priceSource,
    currentUnitPrice,
    qty,
    lineTotalOverride,
    hasLineTotalOverrideKey,
  )
  const currentUnsettled = priceSource && posPriceDisplayHasRange(priceSource) && !posPriceDisplayHasFinalPrice(priceSource)
  const currentUnitDisplay = currentUnsettled ? 'Not set' : `RM ${Number(currentUnitPrice ?? 0).toFixed(2)}`

  if (showBreakdown) {
    return (
      <QuantityBreakdownSummary
        originalUnitDisplay={originalUnitDisplay}
        originalLineTotalDisplay={originalLineTotalDisplay}
        currentUnitDisplay={currentUnitDisplay}
        currentLineTotalDisplay={currentLineTotalDisplay}
        quantity={qty}
      />
    )
  }

  if (qty > 1) {
    return (
      <QuantityBreakdownSummary
        originalUnitDisplay={originalUnitDisplay}
        originalLineTotalDisplay={originalLineTotalDisplay}
        currentUnitDisplay={currentUnitDisplay}
        currentLineTotalDisplay={currentLineTotalDisplay}
        quantity={qty}
      />
    )
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      <SummarySection tone="reference">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell tone="reference" label="Original Price / Reference Range" value={originalUnitDisplay} />
          <SummaryCell tone="reference" label="Original Line Total" value={originalLineTotalDisplay} />
        </div>
      </SummarySection>
      <SummarySection tone="current">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell tone="current" label="Current Price" value={currentUnitDisplay} />
          <SummaryCell tone="current" label="Current Line Total" value={currentLineTotalDisplay} />
        </div>
      </SummarySection>
    </div>
  )
}
