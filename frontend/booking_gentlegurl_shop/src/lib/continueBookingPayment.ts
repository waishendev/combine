import { payBooking, payPublicOrder } from "@/lib/apiClient";
import type { BookingRecord } from "@/lib/types";

export type ContinueBookingPaymentResult =
  | { kind: "redirect"; url: string }
  | { kind: "manual_transfer"; orderId: number; orderNo: string; provider: string }
  | { kind: "error"; message: string };

function normalizeBillplzMethod(method: string): "billplz_online_banking" | "billplz_credit_card" | null {
  if (method === "billplz_fpx" || method === "billplz_online_banking") return "billplz_online_banking";
  if (method === "billplz_card" || method === "billplz_credit_card") return "billplz_credit_card";
  return null;
}

export function resolveBookingPaymentMethod(booking: BookingRecord): string | null {
  const fromPayment = booking.latest_payment?.payment_method;
  if (typeof fromPayment === "string" && fromPayment.trim() !== "") {
    return fromPayment.trim();
  }
  const fromOrder = booking.paid_via_order?.payment_method;
  if (typeof fromOrder === "string" && fromOrder.trim() !== "") {
    return fromOrder.trim();
  }
  return null;
}

/**
 * Resume deposit payment for a HOLD booking using the original checkout method.
 * Billplz cart checkouts must continue via the linked Order, not fake manual transfer.
 */
export async function continueBookingPayment(booking: BookingRecord): Promise<ContinueBookingPaymentResult> {
  const method = resolveBookingPaymentMethod(booking);
  if (!method) {
    return {
      kind: "error",
      message: "Unable to determine the original payment method for this booking. Please open My Transactions or place a new booking.",
    };
  }

  if (method === "manual_transfer") {
    if (!booking.booking_code) {
      return { kind: "error", message: "Booking reference is missing." };
    }
    return {
      kind: "manual_transfer",
      orderId: booking.id,
      orderNo: booking.booking_code,
      provider: String(booking.latest_payment?.provider || booking.paid_via_order?.payment_provider || "manual"),
    };
  }

  const billplzMethod = normalizeBillplzMethod(method);
  if (!billplzMethod) {
    return { kind: "error", message: "Payment method is not supported for Pay Now." };
  }

  const linkedOrderId = Number(booking.paid_via_order?.order_id ?? 0);
  const linkedOrderStatus = String(booking.paid_via_order?.status ?? "").toLowerCase();
  const linkedPaymentStatus = String(booking.paid_via_order?.payment_status ?? "").toLowerCase();
  const linkedPaymentUrl = booking.paid_via_order?.payment_url || booking.latest_payment?.payment_url || null;

  if (linkedOrderId > 0 && linkedOrderStatus === "pending" && linkedPaymentStatus === "unpaid") {
    if (linkedPaymentUrl) {
      return { kind: "redirect", url: linkedPaymentUrl };
    }
    try {
      const response = await payPublicOrder(linkedOrderId, {
        payment_method: billplzMethod,
        billplz_gateway_option_id: booking.paid_via_order?.billplz_gateway_option_id ?? undefined,
      });
      return { kind: "redirect", url: response.redirect_url };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "Unable to continue Billplz payment.",
      };
    }
  }

  if (linkedPaymentUrl && linkedOrderStatus !== "cancelled" && linkedOrderStatus !== "voided") {
    return { kind: "redirect", url: linkedPaymentUrl };
  }

  try {
    const resp = await payBooking(booking.id, {
      payment_method: billplzMethod,
      billplz_gateway_option_id: booking.paid_via_order?.billplz_gateway_option_id ?? undefined,
    });
    const redirectUrl = resp?.data?.payment_url || booking.latest_payment?.payment_url;
    if (redirectUrl) {
      return { kind: "redirect", url: redirectUrl };
    }
    return {
      kind: "error",
      message: "Unable to open the online payment page. Please try again from My Transactions.",
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Unable to continue online payment.",
    };
  }
}
