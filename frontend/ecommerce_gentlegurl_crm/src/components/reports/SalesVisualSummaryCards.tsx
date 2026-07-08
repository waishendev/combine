'use client'

export type SalesVisualMode = 'ecommerce' | 'booking' | 'all'

export type SalesVisualPaymentMethodRow = {
  key: string
  label: string
  online: number
  offline: number
  total: number
}

export type SalesVisualSummaryData = {
  online_offline?: { online: number; offline: number }
  payment_methods?: SalesVisualPaymentMethodRow[]
  refunds?: SalesVisualPaymentMethodRow[]
  item_types?: {
    estimate?: boolean
    product: number
    service: number
    multi_package: number
    package_redemption?: number
    unlimited_plan: number
    other?: number
  }
  staff?: {
    sales_activity?: Array<{
      staff_id: number
      name: string
      product_sales?: number
      total?: number
    }>
    sales_activity_total?: number
    service_activity?: Array<{ staff_id: number; name: string; service_count: number; service_amount?: number; total?: number }>
    service_activity_total?: number
    service_activity_amount_total?: number
  }
}

const fmtRm = (n: number) =>
  `RM ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type SalesVisualSummaryCardsProps = {
  mode: SalesVisualMode
  loading: boolean
  error?: string | null
  data: SalesVisualSummaryData | null
  periodScope?: 'day' | 'month' | 'year'
}

export default function SalesVisualSummaryCards({
  mode,
  loading,
  error,
  data,
  periodScope = 'day',
}: SalesVisualSummaryCardsProps) {
  const payments: SalesVisualPaymentMethodRow[] = Array.isArray(data?.payment_methods)
    ? data!.payment_methods
    : []

  const paymentFinalOnline = payments.reduce((a, p) => a + (Number(p.online) || 0), 0)
  const paymentFinalOffline = payments.reduce((a, p) => a + (Number(p.offline) || 0), 0)
  const paymentFinalTotal = payments.reduce((a, p) => a + (Number(p.total) || 0), 0)
  const refunds: SalesVisualPaymentMethodRow[] = Array.isArray(data?.refunds) ? data!.refunds : []
  const DEFAULT_REFUND_ROWS: SalesVisualPaymentMethodRow[] = [
    { key: 'cash', label: 'Cash Refund', online: 0, offline: 0, total: 0 },
    { key: 'customer_credit', label: 'Customer Credit', online: 0, offline: 0, total: 0 },
  ]
  const refundRowsDisplay: SalesVisualPaymentMethodRow[] = refunds.length > 0 ? refunds : DEFAULT_REFUND_ROWS
  const refundTotalOnline = refunds.reduce((a, p) => a + (Number(p.online) || 0), 0)
  const refundTotalOffline = refunds.reduce((a, p) => a + (Number(p.offline) || 0), 0)
  const refundTotal = refunds.reduce((a, p) => a + (Number(p.total) || 0), 0)
  const itemTypes = data?.item_types
  const itemTypeTotal = itemTypes
    ? (Number(itemTypes.product) || 0) +
      (Number(itemTypes.service) || 0) +
      (Number(itemTypes.multi_package) || 0) +
      (Number(itemTypes.other) || 0)
    : 0
  const staffSales = data?.staff?.sales_activity ?? []
  const staffSvc = data?.staff?.service_activity ?? []
  const oo = data?.online_offline

  const periodWord = periodScope === 'day' ? 'day' : 'period'
  const workspaceLabel = mode === 'ecommerce' ? 'ecommerce' : mode === 'booking' ? 'booking' : 'ecommerce + booking merged'

  return (
    <div className="space-y-4">
      {oo ? (
        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Online <strong className="text-slate-900">{fmtRm(oo.online)}</strong>
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Offline <strong className="text-slate-900">{fmtRm(oo.offline)}</strong>
          </span>
        </div>
      ) : null}

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Payment method</h3>
          <p className="mt-1 text-xs text-slate-500">
            All gateways from settings ({workspaceLabel}). Net amount after discount; online vs offline by order creator.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Refunds are shown separately below and are not mixed into normal payment totals.</p>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No payment gateways configured for this workspace.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[280px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-2 pr-2">Method</th>
                    <th className="pb-2 pr-2 text-right">Online</th>
                    <th className="pb-2 pr-2 text-right">Offline</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.key} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-700">{p.label}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-900">{fmtRm(p.online)}</td>
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-900">{fmtRm(p.offline)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{fmtRm(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="py-2.5 pr-2 text-xs font-bold tracking-wide text-slate-800">FINAL TOTAL</td>
                    <td className="py-2.5 pr-2 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalOnline)}</td>
                    <td className="py-2.5 pr-2 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalOffline)}</td>
                    <td className="py-2.5 text-right text-sm font-bold text-slate-900">{fmtRm(paymentFinalTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
                <h4 className="text-xs font-bold uppercase tracking-wide text-rose-900">Refunds</h4>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {refundRowsDisplay.map((p) => (
                      <tr key={p.key} className="border-b border-rose-100 last:border-b-0">
                        <td className="py-1.5 pr-2 text-rose-800">{p.label}</td>
                        <td className="py-1.5 pr-2 text-right font-medium text-rose-900">{Number(p.online) > 0 ? fmtRm(-Math.abs(Number(p.online))) : fmtRm(0)}</td>
                        <td className="py-1.5 pr-2 text-right font-medium text-rose-900">{Number(p.offline) > 0 ? fmtRm(-Math.abs(Number(p.offline))) : fmtRm(0)}</td>
                        <td className="py-1.5 text-right font-bold text-rose-900">{Number(p.total) > 0 ? fmtRm(-Math.abs(Number(p.total))) : fmtRm(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-rose-200">
                      <td className="py-2 pr-2 font-bold text-rose-900">REFUND TOTAL</td>
                      <td className="py-2 pr-2 text-right font-bold text-rose-900">{refundTotalOnline > 0 ? fmtRm(-Math.abs(refundTotalOnline)) : fmtRm(0)}</td>
                      <td className="py-2 pr-2 text-right font-bold text-rose-900">{refundTotalOffline > 0 ? fmtRm(-Math.abs(refundTotalOffline)) : fmtRm(0)}</td>
                      <td className="py-2 text-right font-bold text-rose-900">{refundTotal > 0 ? fmtRm(-Math.abs(refundTotal)) : fmtRm(0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Item type</h3>
          <p className="text-xs text-blue-600">(estimate)</p>
          {mode === 'ecommerce' ? (
            <p className="mt-1 text-xs text-slate-500">Counts only product / service / service_package lines. Booking lines are excluded here.</p>
          ) : mode === 'all' ? (
            <p className="mt-1 text-xs text-slate-500">
              Product and catalog lines plus booking buckets (deposit, settlement, add-on, package) combined for this {periodWord}.
            </p>
          ) : null}
          {loading || !itemTypes ? (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Product</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.product)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Service</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.service)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Package</span>
                <span className="font-semibold text-slate-900">{fmtRm(itemTypes.multi_package)}</span>
              </li>
              {itemTypes.other != null && itemTypes.other > 0 ? (
                <li className="flex justify-between gap-2">
                  <span className="text-slate-600">Other lines</span>
                  <span className="font-semibold text-slate-900">{fmtRm(itemTypes.other)}</span>
                </li>
              ) : null}
              <li className="flex justify-between gap-2 border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-800">TOTAL</span>
                <span className="font-bold text-slate-900">{fmtRm(itemTypeTotal)}</span>
              </li>
              <li className="mt-3 flex justify-between gap-2 border-t border-dashed border-slate-300 pt-3">
                <span className="text-slate-600">Package Redemption</span>
                <span className="font-semibold text-slate-900">{fmtRm(Number(itemTypes.package_redemption) || 0)}</span>
              </li>
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Staff</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ecommerce</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Product sales (RM)</p>
              {loading ? (
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              ) : staffSales.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No staff configured.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {staffSales.map((s) => (
                    <li key={s.staff_id}>
                      <div className="text-slate-800">{s.name}</div>
                      <div className="font-semibold text-slate-900">{fmtRm(s.total ?? s.product_sales ?? 0)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Completed bookings + booking products</p>
              {loading ? (
                <p className="mt-2 text-sm text-slate-500">Loading…</p>
              ) : staffSvc.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No staff configured.</p>
              ) : (
                <ul className="mt-2 space-y-3 text-sm">
                  {staffSvc.map((s) => (
                    <li key={s.staff_id}>
                      <div className="text-slate-800">{s.name}</div>
                      <div className="font-semibold text-slate-900">{fmtRm(s.service_amount ?? s.total ?? 0)}</div>
                      <div className="text-xs text-slate-500">{s.service_count}×</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {!loading ? (
            <div className="mt-3 grid gap-4 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900 sm:grid-cols-2">
              <div>Total {fmtRm(data?.staff?.sales_activity_total ?? 0)}</div>
              <div>Total {fmtRm(data?.staff?.service_activity_amount_total ?? 0)} · {data?.staff?.service_activity_total ?? 0}×</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
