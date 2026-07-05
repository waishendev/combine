import type { BookingRecord } from "@/lib/types";
import { formatOrderPaymentMethod } from "@/lib/orderPaymentDisplay";

export type BookingReceiptRow = NonNullable<BookingRecord["receipts"]>[number];

export function resolveReceiptViewUrl(url?: string | null): string | null {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("/invoice")) return trimmed;
  return `${trimmed.replace(/\/$/, "")}/invoice`;
}

export function getBookingReceiptRows(booking: BookingRecord): BookingReceiptRow[] {
  return (booking.receipts ?? []).filter((row) => Boolean(resolveReceiptViewUrl(row.receipt_public_url)));
}

export function formatReceiptPaidDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatReceiptMeta(receipt: BookingReceiptRow): string {
  const parts: string[] = [];
  if (receipt.order_number) parts.push(receipt.order_number);
  if (Number(receipt.amount ?? 0) > 0) parts.push(`RM ${Number(receipt.amount).toFixed(2)}`);
  const paidAt = formatReceiptPaidDate(receipt.paid_at);
  if (paidAt) parts.push(paidAt);
  const method = formatOrderPaymentMethod(receipt.payment_method);
  if (method && method !== "N/A") parts.push(method);
  return parts.join(" · ");
}
