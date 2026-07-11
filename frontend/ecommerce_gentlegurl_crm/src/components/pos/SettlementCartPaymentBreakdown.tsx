'use client'

import { useMemo } from 'react'

import {
  computeSettlementCartPaymentBreakdown,
  type SettlementCartItemLike,
  type SettlementRefundSummary,
} from '@/components/pos/settlementAmountUtils'

type Props = {
  settlement: SettlementCartItemLike
  variant?: 'cart' | 'checkout'
  className?: string
}

type RefundRowsProps = {
  summary: SettlementRefundSummary
  variant?: 'cart' | 'checkout'
  rowClass: string
}

export function SettlementRefundBreakdownRows({
  summary,
  variant = 'cart',
  rowClass,
}: RefundRowsProps) {
  const isCheckout = variant === 'checkout'

  if (!summary.showRefundSection) return null

  if (summary.displayMode === 'history') {
    return (
      <div className={`${rowClass} space-y-0.5`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-sky-800">Refunded</span>
          <span className="font-bold tabular-nums text-sky-800">
            − RM {summary.refundedTotal.toFixed(2)}
          </span>
        </div>
        {/* {summary.refundIssuedLines.length === 1 ? (
          <p className="text-[10px] font-medium text-sky-700">{summary.refundIssuedLines[0].methodLabel}</p>
        ) : summary.refundIssuedLines.length > 1 ? (
          <p className="text-[10px] font-medium text-sky-700">
            {summary.refundIssuedLines.map((line) => line.methodLabel).join(' · ')}
          </p>
        ) : null} */}
      </div>
    )
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
        <span className="text-slate-600">Refund Required</span>
        <span className="font-medium tabular-nums text-slate-900">
          RM {summary.refundRequired.toFixed(2)}
        </span>
      </div>
      <div className={`${rowClass} space-y-0.5`}>
        <div className="flex items-center justify-between gap-3">
          <span
            className={
              summary.refundedTotal > 0.0001
                ? 'font-semibold text-sky-800'
                : 'text-slate-600'
            }
          >
            Refunded
          </span>
          <span
            className={`font-bold tabular-nums ${
              summary.refundedTotal > 0.0001 ? 'text-sky-800' : 'text-slate-500'
            }`}
          >
            − RM {summary.refundedTotal.toFixed(2)}
          </span>
        </div>
        {/* {summary.refundIssuedLines.length === 1 ? (
          <p className="text-[10px] font-medium text-sky-700">{summary.refundIssuedLines[0].methodLabel}</p>
        ) : summary.refundIssuedLines.length > 1 ? (
          <p className="text-[10px] font-medium text-sky-700">
            {summary.refundIssuedLines.map((line) => line.methodLabel).join(' · ')}
          </p>
        ) : null} */}
      </div>
      <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
        <span
          className={
            summary.remainingRefund > 0.0001
              ? 'font-semibold text-rose-700'
              : 'font-semibold text-emerald-800'
          }
        >
          Remaining Refund
        </span>
        <span
          className={`font-bold tabular-nums ${
            summary.remainingRefund > 0.0001 ? 'text-rose-700' : 'text-emerald-800'
          }`}
        >
          RM {summary.remainingRefund.toFixed(2)}
        </span>
      </div>
      {summary.remainingRefund > 0.0001 && isCheckout ? (
        <p className="text-[11px] mb-3 font-medium text-rose-700">
          Open Edit Settlement to refund to the customer before checkout.
        </p>
      ) : null}
      {/* {summary.refundSettled ? (
        <p className={`${isCheckout ? 'px-0 py-2 text-xs' : 'py-2 text-[10px]'} font-medium leading-snug text-emerald-700`}>
          Overpayment fully settled — customer has been refunded or credited.
        </p>
      ) : null} */}
    </>
  )
}

export default function SettlementCartPaymentBreakdown({
  settlement,
  variant = 'cart',
  className = '',
}: Props) {
  const breakdown = useMemo(
    () => computeSettlementCartPaymentBreakdown(settlement),
    [settlement],
  )

  const isCheckout = variant === 'checkout'
  const labelClass = isCheckout
    ? 'text-xs font-semibold uppercase tracking-wide text-slate-600'
    : 'text-[10px] font-semibold uppercase tracking-wide text-gray-500'
  const rowClass = isCheckout ? 'py-2.5 text-sm' : 'py-3 text-sm'
  const valueClass = 'font-medium tabular-nums text-slate-900'
  const totalLabelClass = isCheckout
    ? 'text-sm font-bold text-slate-900'
    : 'text-[9px] font-semibold uppercase tracking-wide text-gray-500'
  const totalValueClass = isCheckout
    ? 'text-lg font-bold tabular-nums text-orange-700'
    : 'text-sm font-bold tabular-nums text-orange-700'

  return (
    <div className={className}>
      <h4 className={`${labelClass} ${isCheckout ? 'mb-2 border-b border-slate-100 pb-2' : 'mb-1'}`}>
        Payment breakdown
      </h4>
      <div className={`divide-y divide-slate-100 ${isCheckout ? 'rounded-lg border border-slate-200 bg-white px-3' : ''}`}>
        <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
          <span className="text-slate-600">Service Value</span>
          <span className={valueClass}>{breakdown.serviceValueDisplay}</span>
        </div>
        {breakdown.hasAddons ? (
          <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
            <span className="text-slate-600">Add-ons</span>
            <span className={valueClass}>{breakdown.addonDisplay}</span>
          </div>
        ) : null}
        <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
          <span className="text-slate-600">Deposit Paid</span>
          <span className={`${valueClass} text-slate-800`}>
            {breakdown.depositTotal > 0.0001 ? `− RM ${breakdown.depositTotal.toFixed(2)}` : '—'}
          </span>
        </div>
        {breakdown.showPackageCovered ? (
          <div className={`flex items-center justify-between gap-3 ${rowClass}`}>
            <span className="text-slate-600">Package Covered</span>
            <span className="font-medium tabular-nums text-emerald-800">
              {breakdown.packageCoveredDisplay}
            </span>
          </div>
        ) : null}
        <SettlementRefundBreakdownRows
          summary={breakdown.refundSummary}
          variant={variant}
          rowClass={rowClass}
        />
        {breakdown.mainCoveredAddonDueNote ? (
          <p className={`${isCheckout ? 'px-0 py-2 text-xs' : 'py-2 text-[10px]'} leading-snug text-slate-600`}>
            Package covers the <strong className="font-medium text-slate-900">main service</strong> only.
            Add-on balance above is still due at checkout.
          </p>
        ) : null}
        <div
          className={`flex items-center justify-between gap-3 border-t-2 border-slate-200 ${
            isCheckout ? 'bg-emerald-50/40 py-3' : 'pt-2'
          }`}
        >
          <span className={totalLabelClass}>Amount To Pay</span>
          <span className={totalValueClass}>{breakdown.amountToPayDisplay}</span>
        </div>
      </div>
    </div>
  )
}
