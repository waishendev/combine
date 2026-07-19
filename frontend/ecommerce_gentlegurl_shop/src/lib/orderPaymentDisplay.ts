export type OrderPaymentRow = {
  method: string;
  amount: number;
};

export type OrderPaymentSource = {
  payment_method?: string | null;
  grand_total?: number | string | null;
  payments?: Array<{
    method?: string | null;
    payment_method?: string | null;
    amount?: number | string | null;
  }> | null;
};

export function formatOrderPaymentMethod(method?: string | null): string {
  const key = String(method ?? "").toLowerCase();
  if (key === "cash") return "Cash";
  if (key === "qrpay") return "QRPay";
  if (key === "manual_transfer") return "Manual Transfer";
  if (key === "customer_balance") return "Customer Balance";
  if (key === "billplz_online_banking") return "Online Banking";
  if (key === "billplz_credit_card" || key === "credit_card") return "Credit Card";
  if (key === "split") return "Split";
  return method || "N/A";
}

export function formatOrderPaymentMethodsLabel(order: OrderPaymentSource): string {
  const rows = normalizeOrderPayments(order);
  if (rows.length > 0) {
    return rows.map((payment) => formatOrderPaymentMethod(payment.method)).join(", ");
  }
  return formatOrderPaymentMethod(order.payment_method);
}

export function normalizeOrderPayments(order: OrderPaymentSource): OrderPaymentRow[] {
  const rows = (order.payments ?? [])
    .map((payment) => ({
      method: String(payment.method ?? payment.payment_method ?? "").trim(),
      amount: Number(payment.amount ?? 0),
    }))
    .filter((payment) => payment.method && Number.isFinite(payment.amount) && payment.amount > 0);

  if (rows.length > 0) {
    return rows;
  }

  const method = String(order.payment_method ?? "").trim().toLowerCase();
  const total = Number(order.grand_total ?? 0);
  if (method && method !== "split" && Number.isFinite(total) && total > 0) {
    return [{ method, amount: total }];
  }

  return [];
}
