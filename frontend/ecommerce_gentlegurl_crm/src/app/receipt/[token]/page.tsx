export const dynamic = 'force-dynamic'

type ReceiptItem = {
  sku?: string
  name: string
  variant_name?: string
  qty: number
  unit_price: number
  line_total?: number
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
  items: ReceiptItem[]
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-gray-900">
      <div className="mb-5 flex flex-col justify-between gap-8 border-b border-gray-200 pb-6 md:flex-row">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">GentleGurl</h1>
          <p className="text-sm text-gray-500">Public {docTitle.toLowerCase()} page</p>
        </div>

        <div className="md:text-right">
          <p className="text-3xl font-extrabold tracking-widest">{docTitle}</p>
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
            {receipt.items.map((item, idx) => (
              <tr key={`${item.sku}-${idx}`} className="border-t border-gray-200 text-sm">
                <td className="px-4 py-3">
                  <p className="font-semibold">{item.name}</p>
                  {item.sku ? <p className="text-xs text-gray-500">SKU: {item.sku}</p> : null}
                  {item.variant_name ? <p className="text-xs text-gray-500">Variant: {item.variant_name}</p> : null}
                </td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{money(item.unit_price)}</td>
                <td className="px-4 py-3 text-right">{money(item.line_total ?? item.qty * item.unit_price)}</td>
              </tr>
            ))}
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
              <td className="px-4 py-2 text-gray-500">Discount</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.discount_total)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-500">Shipping</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.shipping_fee)}</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider">Grand Total</td>
              <td className="px-4 py-3 text-right text-base font-extrabold">{money(receipt.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <p className="font-semibold text-gray-700">Thank you for your purchase.</p>
        <p className="mt-1">This is a public receipt view generated electronically.</p>
      </div>
    </div>
  )
}
