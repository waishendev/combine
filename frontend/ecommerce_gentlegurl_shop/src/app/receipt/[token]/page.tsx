export const dynamic = "force-dynamic";
import { Fragment } from "react";

const HIDDEN_RECEIPT_VARIANT_LABELS = new Set([
  'Final Settlement',
  'Booking Add-on Settlement',
  'Service',
  'Booking Deposit',
  'Booking Add-on Deposit',
]);

const COMBINED_BOOKING_SETTLEMENT_LINE_TYPES = new Set(['booking_settlement', 'booking_addon']);

function shouldShowReceiptVariant(variantName?: string | null) {
  return Boolean(variantName && !HIDDEN_RECEIPT_VARIANT_LABELS.has(variantName));
}

function shouldShowReceiptItem(item: Pick<ReceiptItem, 'type' | 'name'>) {
  return !(
    item.name.includes('::') &&
    COMBINED_BOOKING_SETTLEMENT_LINE_TYPES.has(String(item.type ?? ''))
  );
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
  method?: string | null;
  payment_method?: string | null;
  amount?: number | string | null;
  reference_no?: string | null;
  reference?: string | null;
};

type ReceiptItem = {
  type?: string;
  sku?: string;
  name: string;
  cn_name?: string | null;
  variant_name?: string;
  qty: number;
  unit_price: number;
  line_total?: number;
  line_total_snapshot?: number;
  discount_amount?: number;
  line_total_after_discount?: number;
  covered_by_package?: boolean;
  package_applied_name?: string | null;
  selected_booking_product_options?: Array<{ options?: Array<{ label?: string; cn_label?: string | null; extra_price?: number }> }>;
};

type ReceiptData = {
  order_number: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  payments?: ReceiptPayment[] | null;
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

function normalizeReceiptPayments(payments: ReceiptData['payments']) {
  if (!Array.isArray(payments)) return [];
  return payments
    .map((payment, index) => {
      const method = String(payment?.method ?? payment?.payment_method ?? '').trim();
      const amount = Number(payment?.amount ?? 0);
      const reference = String(payment?.reference_no ?? payment?.reference ?? '').trim();
      return { method, amount, reference, key: `${method || 'payment'}-${amount}-${reference || index}` };
    })
    .filter((payment) => payment.method && Number.isFinite(payment.amount) && payment.amount > 0);
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

function resolveItemLabel(item: ReceiptItem) {
  const lineType = String(item.type ?? "").toLowerCase();
  if (lineType === "booking_addon") return `Add-on - ${item.name}`;
  return item.name;
}

function ItemNameStack({ name, cnName }: { name: string; cnName?: string | null }) {
  return (
    <>
      <p className="font-semibold">{name}</p>
      {cnName ? <p className="mt-0.5 text-xs text-[var(--foreground)]/60">{cnName}</p> : null}
    </>
  );
}

export default async function PublicReceiptPage({ params }: Props) {
  const { token } = await params;
  const receipt = await getReceipt(token);

  if (!receipt) {
    return <div className="mx-auto max-w-4xl px-6 py-10">Receipt not found.</div>;
  }

  const isPaid = (receipt.payment_status ?? "").toLowerCase() === "paid";
  const docTitle = isPaid ? "RECEIPT" : "INVOICE";
  const receiptPayments = normalizeReceiptPayments(receipt.payments);

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
                <td className="font-semibold">{receiptPayments.length ? receiptPayments.map((payment) => <div key={payment.key}>{formatPaymentMethod(payment.method)} RM {payment.amount.toFixed(2)}{payment.reference ? <span className="font-normal text-[var(--foreground)]/60"> ({payment.reference})</span> : null}</div>) : formatPaymentMethod(receipt.payment_method)}</td>
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
            {receipt.items.filter(shouldShowReceiptItem).map((item, index) => {
              const isCoveredByPackage = Boolean(item.covered_by_package);
              const gross = Number(item.line_total_snapshot ?? item.line_total ?? item.qty * item.unit_price);
              const net = isCoveredByPackage ? 0 : Number(item.line_total_after_discount ?? item.line_total ?? gross - Number(item.discount_amount ?? 0));
              const bookingProductAddons = Array.isArray(item.selected_booking_product_options)
                ? item.selected_booking_product_options.flatMap((q) => q.options ?? [])
                : [];

              return (
                <Fragment key={`${item.sku ?? item.name}-${index}`}>
                <tr className="border-t border-[var(--card-border)] text-sm">
                  <td className="px-4 py-3">
                    <ItemNameStack name={resolveItemLabel(item)} cnName={item.cn_name} />
                    {item.sku ? <p className="text-xs text-[var(--foreground)]/70">SKU: {item.sku}</p> : null}
                    {shouldShowReceiptVariant(item.variant_name) ? (
                      <p className="text-xs text-[var(--foreground)]/70">Variant: {item.variant_name}</p>
                    ) : null}
                    {isCoveredByPackage ? (
                      <>
                        <p className="text-xs font-semibold text-emerald-700">Included in package</p>
                        {item.package_applied_name ? (
                          <p className="text-xs text-emerald-700">Package Applied: {item.package_applied_name}</p>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">{item.qty}</td>
                  <td className="px-4 py-3 text-right">{money(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right">
                    {isCoveredByPackage ? (
                      <div>
                        <p className="text-xs text-[var(--foreground)]/50 line-through">{money(gross)}</p>
                        <p className="font-semibold text-emerald-700">{money(net)}</p>
                      </div>
                    ) : money(net)}
                  </td>
                </tr>
                {bookingProductAddons.map((opt, optIdx) => (
                  <tr key={`shop-receipt-addon-${index}-${optIdx}`} className="border-t border-[var(--card-border)] bg-[var(--muted)]/25 text-sm">
                    <td className="px-4 py-2 pl-8">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--foreground)]/60">Add-on</p>
                      <p className="text-[var(--foreground)]">{opt.label}</p>
                      {opt.cn_label ? <p className="text-xs text-[var(--foreground)]/60">{opt.cn_label}</p> : null}
                    </td>
                    <td className="px-4 py-2 text-right">{item.qty}</td>
                    <td className="px-4 py-2 text-right">{money(Number(opt.extra_price ?? 0))}</td>
                    <td className="px-4 py-2 text-right">{money(Number(opt.extra_price ?? 0) * Number(item.qty ?? 1))}</td>
                  </tr>
                ))}
                </Fragment>
              );
            })}
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
