export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ token: string }>
}

async function getReceipt(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  const res = await fetch(`${baseUrl}/api/public/receipt/${token}`, { cache: 'no-store' })
  const json = await res.json()

  if (!res.ok) {
    return null
  }

  return json.data
}

export default async function PublicReceiptPage({ params }: Props) {
  const { token } = await params
  const receipt = await getReceipt(token)

  if (!receipt) {
    return <div className="mx-auto max-w-2xl px-6 py-10">Receipt not found.</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Receipt {receipt.order_number}</h1>
      <p>Status: {receipt.status} · Payment: {receipt.payment_status}</p>
      <p>Method: {receipt.payment_method}</p>

      <div className="rounded border p-4">
        {receipt.items.map((item: { sku?: string; name: string; variant_name?: string; qty: number; unit_price: number }, idx: number) => (
          <div key={`${item.sku}-${idx}`} className="mb-2 flex items-center justify-between text-sm">
            <div>
              <p>{item.name}</p>
              <p className="text-xs text-gray-500">{item.variant_name} · {item.sku}</p>
            </div>
            <p>{item.qty} x RM {Number(item.unit_price).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="text-right text-sm">
        <p>Subtotal: RM {Number(receipt.subtotal).toFixed(2)}</p>
        <p>Total: <span className="font-semibold">RM {Number(receipt.grand_total).toFixed(2)}</span></p>
      </div>
    </div>
  )
}
