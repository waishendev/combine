export const dynamic = "force-dynamic";

type ReceiptItem = {
  sku?: string;
  name: string;
  variant_name?: string;
  qty: number;
  unit_price: number;
  line_total?: number;
  covered_by_package?: boolean;
  package_applied_name?: string | null;
};

type ReceiptData = {
  order_number: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  created_at?: string;
  subtotal: number;
  discount_total?: number;
  shipping_fee?: number;
  grand_total: number;
  items: ReceiptItem[];
  package_coverage?: {
    covered?: boolean;
    package_offset?: number;
    package_names?: string[];
    note?: string | null;
  };
};

type Props = {
  params: Promise<{ token: string }>;
};

async function getReceipt(token: string): Promise<ReceiptData | null> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${apiBase}/api/public/receipt/${token}`, { cache: "no-store" });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

function money(amount: number | undefined) {
  return `RM ${Number(amount ?? 0).toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function PublicReceiptPage({ params }: Props) {
  const { token } = await params;
  const receipt = await getReceipt(token);

  if (!receipt) {
    return <div className="mx-auto max-w-4xl px-6 py-10">Receipt not found.</div>;
  }

  const isPaid = (receipt.payment_status ?? "").toLowerCase() === "paid";
  const docTitle = isPaid ? "RECEIPT" : "INVOICE";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-[var(--foreground)]">
      <div className="mb-5 flex flex-col justify-between gap-8 border-b border-[var(--card-border)] pb-6 md:flex-row">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">GentleGurl</h1>
          <p className="text-sm text-[var(--foreground)]/70">Public {docTitle.toLowerCase()} page</p>
        </div>

        <div className="md:text-right">
          <p className="text-3xl font-extrabold tracking-widest">{docTitle}</p>
          <table className="mt-3 w-full text-left text-sm md:text-right">
            <tbody>
              <tr>
                <td className="pr-4 text-[var(--foreground)]/70 md:pr-8">
                  {docTitle === "RECEIPT" ? "Receipt No" : "Invoice No"}
                </td>
                <td className="font-semibold">{receipt.order_number}</td>
              </tr>
              <tr>
                <td className="pr-4 text-[var(--foreground)]/70 md:pr-8">Order Date</td>
                <td className="font-semibold">{formatDate(receipt.created_at)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-[var(--foreground)]/70 md:pr-8">Payment Method</td>
                <td className="font-semibold">{receipt.payment_method || "-"}</td>
              </tr>
              <tr>
                <td className="pr-4 text-[var(--foreground)]/70 md:pr-8">Payment Status</td>
                <td className="font-semibold uppercase">{receipt.payment_status || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--myorder-background)]">
        <table className="w-full">
          <thead className="bg-[var(--muted)]/40 text-left text-xs uppercase tracking-wider text-[var(--foreground)]/70">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, index) => (
              <tr key={`${item.sku ?? item.name}-${index}`} className="border-t border-[var(--card-border)] text-sm">
                <td className="px-4 py-3">
                  <p className="font-semibold">{item.name}</p>
                  {item.sku ? <p className="text-xs text-[var(--foreground)]/70">SKU: {item.sku}</p> : null}
                  {item.variant_name ? (
                    <p className="text-xs text-[var(--foreground)]/70">Variant: {item.variant_name}</p>
                  ) : null}
                  {item.covered_by_package ? (
                    <>
                      <p className="text-xs font-semibold text-emerald-700">Covered by Package</p>
                      {item.package_applied_name ? (
                        <p className="text-xs text-emerald-700">Package Applied: {item.package_applied_name}</p>
                      ) : null}
                    </>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{money(item.unit_price)}</td>
                <td className="px-4 py-3 text-right">{money(item.line_total ?? item.qty * item.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-sm overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--myorder-background)]">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-[var(--card-border)]">
              <td className="px-4 py-2 text-[var(--foreground)]/70">Subtotal</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.subtotal)}</td>
            </tr>
            <tr className="border-b border-[var(--card-border)]">
              <td className="px-4 py-2 text-[var(--foreground)]/70">Discount</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.discount_total)}</td>
            </tr>
            <tr className="border-b border-[var(--card-border)]">
              <td className="px-4 py-2 text-[var(--foreground)]/70">Shipping</td>
              <td className="px-4 py-2 text-right font-semibold">{money(receipt.shipping_fee)}</td>
            </tr>
            {receipt.package_coverage?.covered && (receipt.package_coverage?.package_offset ?? 0) > 0 ? (
              <tr className="border-b border-[var(--card-border)]">
                <td className="px-4 py-2 text-[var(--foreground)]/70">Package Offset</td>
                <td className="px-4 py-2 text-right font-semibold">- {money(receipt.package_coverage?.package_offset)}</td>
              </tr>
            ) : null}
            <tr className="bg-[var(--muted)]/40">
              <td className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider">Grand Total</td>
              <td className="px-4 py-3 text-right text-base font-extrabold">{money(receipt.grand_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t border-[var(--card-border)] pt-4 text-xs text-[var(--foreground)]/70">
        <p className="font-semibold text-[var(--foreground)]">Thank you for your purchase.</p>
        <p className="mt-1">This is a public receipt view generated electronically.</p>
      </div>
    </div>
  );
}
