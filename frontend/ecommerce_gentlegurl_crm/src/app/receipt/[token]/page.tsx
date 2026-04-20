export const dynamic = 'force-dynamic'

type ReceiptItem = {
  type?: 'product' | 'booking_deposit' | 'booking_settlement' | 'service_package' | string
  sku?: string
  name: string
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
}

function lineTypeLabel(type?: string) {
  if (type === 'booking_deposit') return 'Booking Deposit'
  if (type === 'booking_settlement') return 'Final Settlement'
  if (type === 'service_package') return 'Service Package'
  return 'Product'
}

type ReceiptData = {
  order_number: string
  status?: string
  payment_status?: string
  payment_method?: string
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

function money(amount: number | undefined) {
  return `RM ${Number(amount ?? 0).toFixed(2)}`
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
  const isPackageCoveredReceipt = Boolean(receipt.package_coverage?.covered)
  const packageCoveredItems = isPackageCoveredReceipt
    ? (receipt.service_items ?? [])
    : receipt.items
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
                <td className="font-semibold">{receipt.payment_method || '-'}</td>
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
            {packageCoveredItems.map((item, idx) => {
              const gross = Number(
                ('line_total_snapshot' in item ? (item as { line_total_snapshot?: number | string | null }).line_total_snapshot : undefined) ??
                  item.line_total ??
                  item.qty * item.unit_price,
              )
              const discountAmount = Number(
                ('discount_amount' in item ? (item as { discount_amount?: number | string | null }).discount_amount : undefined) ?? 0,
              )
              const net = Number(
                ('line_total_after_discount' in item
                  ? (item as { line_total_after_discount?: number | string | null }).line_total_after_discount
                  : undefined) ??
                  item.line_total ??
                  gross - discountAmount,
              )
              return (
              <tr key={`${item.sku}-${idx}`} className="border-t border-gray-200 text-sm">
                <td className="px-4 py-3">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    Type: {isPackageCoveredReceipt ? 'Package-Covered Service' : lineTypeLabel(item.type)}
                  </p>
                  {!isPackageCoveredReceipt && item.sku ? <p className="text-xs text-gray-500">SKU: {item.sku}</p> : null}
                  {!isPackageCoveredReceipt && item.variant_name ? <p className="text-xs text-gray-500">Variant: {item.variant_name}</p> : null}
                  {isPackageCoveredReceipt ? <p className="text-xs text-gray-500">Variant: Service</p> : null}
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
                <td className="px-4 py-3 text-right">{money(item.unit_price)}</td>
                <td className="px-4 py-3 text-right">
                  {discountAmount > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 line-through">{money(gross)}</p>
                      <p className="font-semibold text-amber-700">{money(net)}</p>
                    </div>
                  ) : money(net)}
                </td>
              </tr>
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
                <td className="px-4 py-2 text-gray-500">Package Offset</td>
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
          <p>Payment collected at checkout: RM 0.00</p>
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
