import { Fragment } from 'react'
import { resolveBookingReceiptItemLabel, shouldShowBookingReceiptItem } from '@/lib/bookingReceiptDisplay'
export const dynamic = 'force-dynamic'

const HIDDEN_RECEIPT_VARIANT_LABELS = new Set([
  'Final Settlement',
  'Booking Add-on Settlement',
  'Service',
  'Booking Deposit',
  'Booking Add-on Deposit',
])

function shouldShowReceiptVariant(variantName?: string | null) {
  return Boolean(variantName && !HIDDEN_RECEIPT_VARIANT_LABELS.has(variantName))
}

function shouldShowReceiptItem(item: Pick<ReceiptItem, 'type' | 'name'>) {
  return shouldShowBookingReceiptItem(item)
}

function formatPaymentMethod(method?: string) {
  const key = String(method ?? '').toLowerCase();
  if (key === 'cash') return 'Cash';
  if (key === 'qrpay') return 'QRPay';
  if (key === 'credit_card' || key === 'billplz_credit_card') return 'Credit Card';
  if (key === 'split') return 'Split';
  return method || '-';
}

type ReceiptPayment = {
  method?: string | null
  payment_method?: string | null
  amount?: number | string | null
  reference_no?: string | null
  reference?: string | null
}

type ReceiptItem = {
  type?: 'product' | 'booking_deposit' | 'booking_settlement' | 'booking_addon' | 'service_package' | string
  sku?: string
  name: string
  cn_name?: string | null
  addon_service_context?: string | null
  variant_name?: string
  qty: number
  unit_price: number
  line_total?: number
  line_total_snapshot?: number
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number
  discount_amount?: number
  line_total_after_discount?: number
  discount_remark?: string | null
  covered_by_package?: boolean
  package_applied_name?: string | null
  selected_booking_product_options?: Array<{ options?: Array<{ label?: string; cn_label?: string | null; extra_price?: number }> }>
}

function lineTypeLabel(type?: string) {
  if (type === 'booking_deposit') return 'Booking Deposit'
  if (type === 'booking_settlement') return 'Final Settlement'
  if (type === 'booking_addon') return 'Booking Add-on'
  if (type === 'service_package') return 'Service Package'
  return 'Product'
}

type ReceiptData = {
  order_number: string
  status?: string
  payment_status?: string
  payment_method?: string
  payments?: ReceiptPayment[] | null
  created_at?: string
  subtotal: number
  discount_total?: number
  shipping_fee?: number
  grand_total: number
  receipt_stage?: string
  receipt_stage_label?: string
  items: ReceiptItem[]
  service_items?: Array<{
    type?: 'service' | string
    name: string
    cn_name?: string | null
    qty: number
    unit_price: number
    line_total: number
    sku?: string
    variant_name?: string
  }>
  package_coverage?: {
    covered: boolean
    package_offset: number
    package_names: string[]
    note?: string | null
  }
}

type Props = {
  params: Promise<{ token: string }>
}

async function getReceipt(token: string): Promise<ReceiptData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  const res = await fetch(`${baseUrl}/api/public/receipt/${token}`, { cache: 'no-store' })
  const json = await res.json()

  if (!res.ok) {
    return null
  }

  return json.data
}

function getOriginalUnitPrice(item: Pick<ReceiptItem, 'qty' | 'unit_price' | 'line_total' | 'line_total_snapshot'>) {
  const qtyRaw = Number(item.qty ?? 1)
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1

  const unitPrice = Number(item.unit_price ?? 0)
  const lineTotalSnapshot = Number(item.line_total_snapshot ?? 0)
  const lineTotal = Number(item.line_total ?? 0)

  // If backend snapshot is 0 but the real line_total is present, prefer line_total.
  const originalLineTotal = Math.abs(lineTotalSnapshot) > 0.0001 ? lineTotalSnapshot : lineTotal

  if (Math.abs(unitPrice) > 0.0001) return unitPrice
  if (Math.abs(originalLineTotal) > 0.0001) return originalLineTotal / qty
  return unitPrice
}

function money(amount: number | undefined) {
  return `RM ${Number(amount ?? 0).toFixed(2)}`
}

function ReceiptItemNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="font-semibold">{name}</p>
      {cnName ? <p className="mt-0.5 text-xs text-gray-500">{cnName}</p> : null}
    </>
  )
}

function normalizeReceiptPayments(payments: ReceiptData['payments']) {
  if (!Array.isArray(payments)) return []
  return payments
    .map((payment, index) => {
      const method = String(payment?.method ?? payment?.payment_method ?? '').trim()
      const amount = Number(payment?.amount ?? 0)
      const reference = String(payment?.reference_no ?? payment?.reference ?? '').trim()
      return { method, amount, reference, key: `${method || 'payment'}-${amount}-${reference || index}` }
    })
    .filter((payment) => payment.method && Number.isFinite(payment.amount) && payment.amount > 0)
}

function formatReceiptPaymentMethodsLabel(
  payments: ReturnType<typeof normalizeReceiptPayments>,
  fallbackMethod?: string | null,
) {
  if (payments.length > 0) {
    return payments.map((payment) => formatPaymentMethod(payment.method)).join(', ')
  }
  return formatPaymentMethod(fallbackMethod ?? undefined)
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function PublicReceiptPage({ params }: Props) {
  const { token } = await params
  const receipt = await getReceipt(token)

  if (!receipt) {
    return <div className="mx-auto max-w-4xl px-6 py-10">Receipt not found.</div>
  }

  const isPaid = (receipt.payment_status ?? '').toLowerCase() === 'paid'
  const docTitle = isPaid ? 'RECEIPT' : 'INVOICE'
  const receiptPayments = normalizeReceiptPayments(receipt.payments)
  const isPackageCoveredReceipt = Boolean(receipt.package_coverage?.covered)
  const receiptItems = (receipt.items ?? []).filter(shouldShowReceiptItem)
  const packageOffset = Number(receipt.package_coverage?.package_offset ?? 0)
  const packageNames = receipt.package_coverage?.package_names ?? []

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-gray-900">
      <div className="mb-5 flex flex-col justify-between gap-8 border-b border-gray-200 pb-6 md:flex-row">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">GentleGurl</h1>
          <p className="text-sm text-gray-500">Public {docTitle.toLowerCase()} page</p>
        </div>

        <div className="md:text-right">
          <p className="text-3xl font-extrabold tracking-widest">{docTitle}</p>
          {receipt.receipt_stage_label ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">{receipt.receipt_stage_label}</p>
          ) : null}
          <table className="mt-3 w-full text-left text-sm md:text-right">
            <tbody>
              <tr>
                <td className="pr-4 text-gray-500 md:pr-8">{docTitle === 'RECEIPT' ? 'Receipt No' : 'Invoice No'}</td>
                <td className="font-semibold">{receipt.order_number}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-500 md:pr-8">Order Date</td>
                <td className="font-semibold">{formatDate(receipt.created_at)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-500 md:pr-8">Payment Method</td>
                <td className="font-semibold">{formatReceiptPaymentMethodsLabel(receiptPayments, receipt.payment_method)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-500 md:pr-8">Payment Status</td>
                <td className="font-semibold uppercase">{receipt.payment_status || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receiptItems.map((item, idx) => {
              const itemLabel = resolveBookingReceiptItemLabel(item)
              const isBookingAddonLine = String(item.type ?? '') === 'booking_addon'
              const lineTotalSnapshot = Number(item.line_total_snapshot ?? 0)
              const gross = Math.abs(lineTotalSnapshot) > 0.0001
                ? lineTotalSnapshot
                : Number(item.line_total ?? item.qty * item.unit_price)
              const discountAmount = Number(
                ('discount_amount' in item ? (item as { discount_amount?: number | string | null }).discount_amount : undefined) ?? 0,
              )
              const isCoveredByPackage = Boolean(item.covered_by_package)
              const net = isCoveredByPackage ? 0 : Number(
                ('line_total_after_discount' in item
                  ? (item as { line_total_after_discount?: number | string | null }).line_total_after_discount
                  : undefined) ??
                  item.line_total ??
                  gross - discountAmount,
              )
              const bookingProductAddons = Array.isArray(item.selected_booking_product_options)
                ? item.selected_booking_product_options.flatMap((q) => q.options ?? [])
                : []
              const isBookingProductLine = String(item.type ?? '').toLowerCase() === 'booking_product' || bookingProductAddons.length > 0
              const bookingProductAddonUnitTotal = bookingProductAddons.reduce((sum, opt) => sum + Number(opt.extra_price ?? 0), 0)
              const originalUnitPrice = getOriginalUnitPrice(item)
              const displayUnitPrice = bookingProductAddons.length > 0 ? Math.max(0, originalUnitPrice - bookingProductAddonUnitTotal) : originalUnitPrice
              const displayLineTotal = bookingProductAddons.length > 0 ? Math.max(0, net - (bookingProductAddonUnitTotal * Number(item.qty ?? 1))) : net
              const isZeroFromPackageClaim =
                !isCoveredByPackage && discountAmount <= 0.0001 && Math.abs(gross) > 0.0001 && Math.abs(displayLineTotal) <= 0.0001
              const shouldStrikeOriginal = isCoveredByPackage || discountAmount > 0.0001 || isZeroFromPackageClaim
              return (
              <Fragment key={`${item.sku}-${idx}`}>
              <tr className="border-t border-gray-200 text-sm">
                <td className="px-4 py-3">
                  <ReceiptItemNameStack name={isBookingAddonLine ? `+ ${itemLabel.name}` : itemLabel.name} cnName={item.cn_name} />
                  {itemLabel.serviceContext ? <p className="mt-0.5 text-xs text-gray-500">Service: {itemLabel.serviceContext}</p> : null}
                  <p className="text-xs text-gray-500">
                    Type: {isCoveredByPackage || isZeroFromPackageClaim ? 'Package-Covered Service' : lineTypeLabel(item.type)}
                  </p>
                  {!(isCoveredByPackage || isZeroFromPackageClaim) && item.sku ? <p className="text-xs text-gray-500">SKU: {item.sku}</p> : null}
                  {!(isCoveredByPackage || isZeroFromPackageClaim) && !isBookingProductLine && shouldShowReceiptVariant(item.variant_name) ? (
                    <p className="text-xs text-gray-500">Variant: {item.variant_name}</p>
                  ) : null}
                  {isCoveredByPackage || isZeroFromPackageClaim ? (
                    <div className="mt-1 space-y-0.5 text-xs font-semibold text-emerald-700">
                      <p>Included in package</p>
                      {item.package_applied_name ? <p className="font-medium">Package Applied: {item.package_applied_name}</p> : null}
                    </div>
                  ) : null}
                  {discountAmount > 0 ? (
                    <div className="mt-1 space-y-0.5 text-xs text-amber-700">
                      <p>Original: {money(gross)}</p>
                      <p>
                        Discount:{' '}
                        {'discount_type' in item && item.discount_type === 'percentage'
                          ? `${Number(('discount_value' in item ? (item as { discount_value?: number | string | null }).discount_value : 0) ?? 0)}%`
                          : money(
                              Number(
                                ('discount_value' in item ? (item as { discount_value?: number | string | null }).discount_value : 0) ?? 0,
                              ),
                            )}{' '}
                        ({money(discountAmount)})
                      </p>
                      {/* {'discount_remark' in item && item.discount_remark ? <p>Remark: {item.discount_remark}</p> : null} */}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{money(displayUnitPrice)}</td>
                <td className="px-4 py-3 text-right">
                  {shouldStrikeOriginal ? (
                    <div>
                      <p className="text-xs text-gray-400 line-through">{money(gross)}</p>
                      <p
                        className={isCoveredByPackage || isZeroFromPackageClaim ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}
                      >
                        {money(displayLineTotal)}
                      </p>
                    </div>
                  ) : money(displayLineTotal)}
                </td>
              </tr>
              {bookingProductAddons.map((opt, optIdx) => (
                <tr key={`receipt-addon-row-${idx}-${optIdx}`} className="border-t border-gray-100 bg-gray-50 text-sm">
                  <td className="px-4 py-2">
                    <ReceiptItemNameStack name={opt.label ?? '-'} cnName={opt.cn_label} />
                  </td>
                  <td className="px-4 py-2 text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-right">{money(Number(opt.extra_price ?? 0))}</td>
                  <td className="px-4 py-2 text-right">{money(Number(opt.extra_price ?? 0) * Number(item.qty ?? 1))}</td>
                </tr>
              ))}
              </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-sm overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-500">Subtotal</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.subtotal)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-500">Voucher Discount</td>
              <td className="px-4 py-2 text-right font-semibold">- {money(receipt.discount_total)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-500">Shipping</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.shipping_fee)}</td>
            </tr>
            {isPackageCoveredReceipt ? (
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-500">Package Covered</td>
                <td className="px-4 py-2 text-right font-semibold">- {money(packageOffset)}</td>
              </tr>
            ) : null}
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider">Grand Total</td>
              <td className="px-4 py-3 text-right text-base font-extrabold">{money(receipt.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {isPackageCoveredReceipt ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {/* <p className="font-semibold">{receipt.package_coverage?.note || 'Covered by Package'}</p> */}
          <p>Payment collected at checkout: {money(receipt.grand_total)}</p>
          {packageNames.length > 0 ? (
            <p className="mt-1 text-xs text-emerald-900">Package Applied: {packageNames.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <p className="font-semibold text-gray-700">Thank you for your purchase.</p>
        <p className="mt-1">This is a public receipt view generated electronically.</p>
      </div>
    </div>
  )
}
