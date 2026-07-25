import type { CustomerWalletTransaction } from "@/lib/apiClient";

export const WALLET_PENDING_STATUSES = new Set([
  "pending",
  "pending_payment",
  "pending_proof",
  "waiting_verification",
  "proof_submitted",
]);

export const WALLET_PROOF_REUPLOAD_STATUSES = new Set([
  "pending",
  "pending_proof",
  "waiting_verification",
  "proof_submitted",
]);

export function walletMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `RM ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

export function walletTxLabel(tx: CustomerWalletTransaction) {
  if (tx.type === "topup") return "Top Up";
  if (tx.type === "admin_credit") return "Deposit";
  if (tx.type === "admin_debit") return "Withdrawal";
  if (tx.type === "refund_credit") return "Refund";
  if (tx.type === "checkout_payment") return "Payment";
  if (tx.type === "reversal") return "Reversal";
  if (tx.direction === "credit") return "Deposit";
  if (tx.direction === "debit") return "Payment";
  return "Adjustment";
}

export function isWalletTopupReserveExpired(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  if (tx.status === "expired" || tx.is_reserve_expired) return true;
  if (!tx.reserve_expires_at) return false;
  const expiresAt = new Date(tx.reserve_expires_at).getTime();
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt <= nowMs;
}

export function walletTopupRemainingSeconds(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  if (!tx.reserve_expires_at || isWalletTopupReserveExpired(tx, nowMs)) return null;
  const expiresAt = new Date(tx.reserve_expires_at).getTime();
  if (Number.isNaN(expiresAt)) return null;
  return Math.max(0, Math.floor((expiresAt - nowMs) / 1000));
}

export function walletTopupRemainingLabel(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  const remainingSeconds = walletTopupRemainingSeconds(tx, nowMs);
  if (remainingSeconds === null) return null;
  return `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
}

export function walletStatusLabel(status: string, options?: { remainingLabel?: string | null; expired?: boolean }) {
  if (options?.expired || status === "expired") return "Expired";
  if (status === "pending" || status === "pending_proof") {
    return options?.remainingLabel
      ? `Awaiting proof (${options.remainingLabel} left)`
      : "Awaiting proof";
  }
  if (status === "pending_payment") {
    return options?.remainingLabel
      ? `Awaiting payment (${options.remainingLabel} left)`
      : "Awaiting payment";
  }
  if (status === "waiting_verification" || status === "proof_submitted") return "Pending review";
  if (status === "failed" || status === "rejected") return "Failed";
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  if (status === "reversed") return "Reversed";
  return status.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}

export function walletStatusClass(status: string, expired = false) {
  if (expired || status === "expired") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (WALLET_PENDING_STATUSES.has(status)) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "failed" || status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "cancelled") return "bg-[var(--background-soft)] text-[var(--text-muted)] ring-[var(--card-border)]";
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "reversed") {
    return "bg-[var(--background-soft)] text-[var(--text-muted)] ring-[var(--card-border)]";
  }
  return "bg-[var(--background-soft)] text-[var(--text-muted)] ring-[var(--card-border)]";
}

export function walletReceiptTitle(tx: CustomerWalletTransaction) {
  if (tx.status !== "completed" && tx.status !== "reversed") return "Transaction Details";
  if (tx.type === "topup") return "Top Up Receipt";
  if (tx.type === "refund_credit") return "Refund Receipt";
  if (tx.type === "checkout_payment") return "Payment Receipt";
  if (tx.type === "admin_credit") return "Deposit Receipt";
  return "Wallet Receipt";
}

export function walletFormatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isManualWalletTopup(tx: CustomerWalletTransaction) {
  const key = String(tx.payment_gateway_key ?? "").toLowerCase();
  const provider = String(tx.metadata?.provider ?? "").toLowerCase();
  return key === "manual_transfer" || key === "manual_bank_transfer" || provider === "manual";
}

export function canReuploadWalletProof(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  if (isWalletTopupReserveExpired(tx, nowMs) && !hasUploadedWalletProof(tx)) return false;
  return tx.type === "topup" && isManualWalletTopup(tx) && WALLET_PROOF_REUPLOAD_STATUSES.has(tx.status);
}

export function isBillplzWalletTopup(tx: CustomerWalletTransaction) {
  const key = String(tx.payment_gateway_key ?? "").toLowerCase();
  const provider = String(tx.metadata?.provider ?? "").toLowerCase();
  return provider === "billplz" || key.startsWith("billplz_");
}

export function canPayWalletTopup(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  if (isWalletTopupReserveExpired(tx, nowMs)) return false;
  return tx.type === "topup" && tx.status === "pending_payment" && isBillplzWalletTopup(tx);
}

export function canCancelWalletTopup(tx: CustomerWalletTransaction, nowMs: number = Date.now()) {
  if (isWalletTopupReserveExpired(tx, nowMs)) return false;
  return (
    tx.type === "topup" &&
    (tx.status === "pending" || tx.status === "pending_payment" || tx.status === "pending_proof")
  );
}

export function walletBillplzUrl(tx: CustomerWalletTransaction) {
  const url = tx.metadata?.billplz_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function hasUploadedWalletProof(tx: CustomerWalletTransaction) {
  return Boolean(tx.metadata?.payment_proof_url);
}
