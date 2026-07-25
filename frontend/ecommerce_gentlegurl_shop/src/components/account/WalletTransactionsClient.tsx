"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelCustomerWalletTopup,
  getCustomerWallet,
  getCustomerWalletTransactions,
  payCustomerWalletTopup,
  uploadCustomerWalletPaymentProof,
  type CustomerWalletTransaction,
} from "@/lib/apiClient";
import { bankQrImageCompactClass, BANK_QR_IMAGE_HEIGHT, BANK_QR_IMAGE_WIDTH } from "@/lib/bankQrImage";
import {
  canCancelWalletTopup,
  canPayWalletTopup,
  canReuploadWalletProof,
  hasUploadedWalletProof,
  isWalletTopupReserveExpired,
  WALLET_PENDING_STATUSES,
  walletBillplzUrl,
  walletMoney,
  walletStatusClass,
  walletStatusLabel,
  walletTopupRemainingLabel,
  walletTxLabel,
} from "@/lib/walletUi";
import WalletTopupModal from "@/components/account/WalletTopupModal";
import WalletSuccessModal, { type WalletSuccessState } from "@/components/account/WalletSuccessModal";

type Filter = "all" | "pending" | "completed";

const filterOptions: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
];

function metaString(tx: CustomerWalletTransaction, key: string) {
  const value = tx.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function formatTableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTableTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function WalletTransactionsClient() {
  const [balance, setBalance] = useState("0.00");
  const [transactions, setTransactions] = useState<CustomerWalletTransaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [topupOpen, setTopupOpen] = useState(false);
  const [success, setSuccess] = useState<WalletSuccessState | null>(null);
  const [proofTx, setProofTx] = useState<CustomerWalletTransaction | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofCaptureMode, setProofCaptureMode] = useState<"environment" | "user" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filteredTransactions = useMemo(() => {
    if (filter === "pending") return transactions.filter((tx) => WALLET_PENDING_STATUSES.has(tx.status));
    if (filter === "completed") return transactions.filter((tx) => tx.status === "completed");
    return transactions;
  }, [filter, transactions]);

  const refresh = useCallback(async () => {
    const [wallet, txRows] = await Promise.all([getCustomerWallet(), getCustomerWalletTransactions("all")]);
    setBalance(wallet.wallet_balance ?? wallet.balance ?? "0.00");
    setTransactions(txRows);
    window.dispatchEvent(new CustomEvent("walletBalanceUpdated"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setError("Unable to load wallet activity. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const hasActiveCountdown = transactions.some((tx) => {
      if (!tx.reserve_expires_at) return false;
      if (tx.status === "expired") return false;
      return tx.status === "pending" || tx.status === "pending_payment" || tx.status === "pending_proof";
    });
    if (!hasActiveCountdown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [transactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("wallet_topup") !== "1") return;
    const tx = params.get("tx");
    const paymentMethod = params.get("payment_method");
    setSuccess({
      variant: "payment_submitted",
      reference: tx,
      paymentMethod,
    });
    void refresh().catch(() => undefined);
    params.delete("wallet_topup");
    params.delete("tx");
    params.delete("provider");
    params.delete("payment_method");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [refresh]);

  const clearProofState = () => {
    setProofFile(null);
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(null);
    setProofCaptureMode(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openProofModal = (tx: CustomerWalletTransaction) => {
    setError(null);
    clearProofState();
    setProofTx(tx);
  };

  const closeProofModal = () => {
    setProofTx(null);
    clearProofState();
  };

  const handlePayNow = async (tx: CustomerWalletTransaction) => {
    setError(null);
    setMessage(null);
    setSuccess(null);
    const existingUrl = walletBillplzUrl(tx);
    if (existingUrl) {
      window.location.href = existingUrl;
      return;
    }

    setPayingId(tx.id);
    try {
      const response = await payCustomerWalletTopup(tx.id);
      const paymentUrl = response.data?.payment_url ?? null;
      if (!paymentUrl) {
        setError(response.message || "Unable to open Billplz payment. Please try again.");
        return;
      }
      window.location.href = paymentUrl;
    } catch (err) {
      const apiMessage =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : null;
      setError(apiMessage || "Unable to continue payment. Please try again.");
    } finally {
      setPayingId(null);
    }
  };

  const handleCancel = async (tx: CustomerWalletTransaction) => {
    const confirmed = window.confirm("Cancel this top-up request?");
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    setCancellingId(tx.id);
    try {
      const response = await cancelCustomerWalletTopup(tx.id);
      setMessage(response.message ?? "Top-up cancelled.");
      await refresh();
    } catch (err) {
      const apiMessage =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : null;
      setError(apiMessage || "Unable to cancel this top-up. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  const selectProofFile = (file: File | null) => {
    if (proofPreviewUrl) URL.revokeObjectURL(proofPreviewUrl);
    setProofPreviewUrl(null);
    setProofFile(null);
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Invalid file type. Please upload JPG, PNG, WEBP, or PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum payment proof size is 5MB.");
      return;
    }
    setError(null);
    setProofFile(file);
    if (file.type.startsWith("image/")) {
      setProofPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadProof = async () => {
    if (!proofTx || !proofFile) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCustomerWalletPaymentProof(proofTx.id, proofFile);
      const amount = proofTx.amount;
      const reference = proofTx.transaction_no;
      closeProofModal();
      await refresh();
      setSuccess({
        variant: "proof_submitted",
        amount,
        reference,
      });
    } catch {
      setError("Payment proof upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bankName = proofTx ? metaString(proofTx, "bank_name") || metaString(proofTx, "bank_label") : null;
  const bankAccountName = proofTx ? metaString(proofTx, "bank_account_name") : null;
  const bankAccountNumber = proofTx ? metaString(proofTx, "bank_account_number") : null;
  const bankInstructions = proofTx ? metaString(proofTx, "bank_instructions") : null;
  const bankQr = proofTx ? metaString(proofTx, "bank_qr_image_url") : null;
  const existingProofUrl = proofTx ? metaString(proofTx, "payment_proof_url") : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Wallet Activity</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--foreground)]/70">
          Top-ups, balance adjustments, and payment proof status for your customer balance.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]/70 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(var(--accent-rgb), 0.14), transparent 55%), radial-gradient(ellipse at bottom left, rgba(var(--background-soft-rgb), 0.9), transparent 48%)",
          }}
        />
        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Available Balance
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-[var(--accent-stronger)]">
              {loading ? "…" : walletMoney(balance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMessage(null);
              setSuccess(null);
              setTopupOpen(true);
            }}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] sm:w-auto"
          >
            Top Up Balance
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error && !proofTx && !topupOpen ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-muted)]">
            <span className="font-medium text-[var(--foreground)]">{filteredTransactions.length}</span>
            {filter === "all" ? " transactions" : ` ${filter} transactions`}
          </p>
          <div
            role="tablist"
            aria-label="Filter wallet activity"
            className="grid grid-cols-3 rounded-xl border border-[var(--input-border)] bg-[var(--background-soft)]/70 p-1"
          >
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  filter === option.key
                    ? "bg-[var(--card)] text-[var(--accent-stronger)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--accent-strong)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[4.5rem] animate-pulse rounded-xl border border-[var(--input-border)] bg-[var(--background-soft)]/60"
              />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--input-border)] px-6 py-14 text-center">
            <p className="text-base font-semibold text-[var(--accent-stronger)]">
              {filter === "all" ? "No activity yet" : `No ${filter} activity`}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">
              {filter === "pending"
                ? "You’re all caught up — nothing is waiting for review."
                : "Top up your balance and your movements will show here."}
            </p>
            {filter !== "all" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-4 text-sm font-semibold text-[var(--accent-strong)] underline underline-offset-2"
              >
                Show all activity
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setTopupOpen(true);
                }}
                className="mt-5 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)]"
              >
                Top Up
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--input-border)] bg-[var(--card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--input-border)] bg-[var(--background-soft)]/70">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="whitespace-nowrap px-4 py-3 sm:px-5">Date</th>
                    <th className="whitespace-nowrap px-4 py-3 sm:px-5">Type</th>
                    {/* <th className="whitespace-nowrap px-4 py-3 sm:px-5">Reference</th> */}
                    <th className="whitespace-nowrap px-4 py-3 sm:px-5">Method</th>
                    <th className="whitespace-nowrap px-4 py-3 sm:px-5">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right sm:px-5">Amount</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right sm:px-5">Balance</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right sm:px-5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const isCredit = tx.direction === "credit";
                    const expired = isWalletTopupReserveExpired(tx, now);
                    const remainingLabel = walletTopupRemainingLabel(tx, now);
                    const showReupload = canReuploadWalletProof(tx, now);
                    const showPayNow = canPayWalletTopup(tx, now);
                    const showCancel = canCancelWalletTopup(tx, now);
                    const alreadyUploaded = hasUploadedWalletProof(tx);
                    const isPaying = payingId === tx.id;
                    const isCancelling = cancellingId === tx.id;
                    return (
                      <tr
                        key={tx.id}
                        className="border-t border-[var(--muted)]/40 transition hover:bg-[var(--background-soft)]/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle sm:px-5">
                          <p className="font-medium text-[var(--accent-stronger)]">{formatTableDate(tx.created_at)}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatTableTime(tx.created_at)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle font-semibold text-[var(--accent-stronger)] sm:px-5">
                          {walletTxLabel(tx)}
                        </td>
                        {/* <td className="whitespace-nowrap px-4 py-3.5 align-middle text-[var(--text-muted)] sm:px-5">
                          {tx.transaction_no || "—"}
                        </td> */}
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle text-[var(--text-muted)] sm:px-5">
                          {tx.payment_method_label || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 align-middle sm:px-5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${walletStatusClass(tx.status, expired)}`}
                          >
                            {walletStatusLabel(tx.status, { remainingLabel, expired })}
                          </span>
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3.5 text-right align-middle font-semibold tabular-nums sm:px-5 ${
                            isCredit ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {isCredit ? "+" : "−"} {walletMoney(tx.amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle tabular-nums text-[var(--text-muted)] sm:px-5">
                          {walletMoney(tx.balance_after)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle sm:px-5">
                          {showPayNow || showReupload || showCancel ? (
                            <div className="inline-flex flex-wrap items-center justify-end gap-2">
                              {showPayNow ? (
                                <button
                                  type="button"
                                  disabled={isPaying || isCancelling}
                                  onClick={() => void handlePayNow(tx)}
                                  className="rounded-lg bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-stronger)] disabled:opacity-60"
                                >
                                  {isPaying ? "Opening…" : "Pay Now"}
                                </button>
                              ) : null}
                              {showReupload ? (
                                <button
                                  type="button"
                                  disabled={isCancelling}
                                  onClick={() => openProofModal(tx)}
                                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60"
                                >
                                  {alreadyUploaded ? "Reupload" : "Upload proof"}
                                </button>
                              ) : null}
                              {showCancel ? (
                                <button
                                  type="button"
                                  disabled={isPaying || isCancelling}
                                  onClick={() => void handleCancel(tx)}
                                  className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                                >
                                  {isCancelling ? "Cancelling…" : "Cancel"}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {proofTx ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-[var(--input-border)] bg-[var(--input-bg)] shadow-xl sm:rounded-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--muted)] px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--accent-strong)]">
                  {hasUploadedWalletProof(proofTx) ? "Reupload Payment Proof" : "Upload Payment Proof"}
                </h3>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                  {proofTx.transaction_no}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProofModal}
                className="rounded-full p-1 text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--background-soft)] px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                  Amount to transfer
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-[var(--accent-stronger)]">
                  {walletMoney(proofTx.amount)}
                </p>
                {/* {proofTx.transaction_no ? (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Ref: {proofTx.transaction_no}</p>
                ) : null} */}
              </div>

              {(bankName || bankAccountName || bankAccountNumber) && (
                <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card)] p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Transfer to
                  </p>
                  {bankName ? <p className="mt-2 font-semibold text-[var(--accent-stronger)]">{bankName}</p> : null}
                  {bankAccountName || bankAccountNumber ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {[bankAccountName, bankAccountNumber].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  {bankInstructions ? (
                    <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{bankInstructions}</p>
                  ) : null}
                  {bankQr ? (
                    <img
                      src={bankQr}
                      alt="Bank QR"
                      width={BANK_QR_IMAGE_WIDTH}
                      height={BANK_QR_IMAGE_HEIGHT}
                      className={`${bankQrImageCompactClass} mt-4`}
                    />
                  ) : null}
                </div>
              )}

              {existingProofUrl ? (
                <div className="rounded-lg border border-[var(--input-border)] bg-[var(--background-soft)]/70 px-4 py-3 text-sm">
                  <p className="font-medium text-[var(--accent-stronger)]">Current proof on file</p>
                  <a
                    href={existingProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-[var(--accent-strong)] underline underline-offset-2"
                  >
                    View uploaded proof
                  </a>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Uploading again will replace the previous proof for staff review.
                  </p>
                </div>
              ) : null}

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Select a new proof file</p>
                <p className="mt-1 text-amber-900/90">JPG, PNG, WEBP, or PDF · max 5MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  capture={proofCaptureMode ?? undefined}
                  onChange={(event) => selectProofFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProofCaptureMode(null);
                      setTimeout(() => fileRef.current?.click(), 0);
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProofCaptureMode("environment");
                      setTimeout(() => fileRef.current?.click(), 0);
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Back camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProofCaptureMode("user");
                      setTimeout(() => fileRef.current?.click(), 0);
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Front camera
                  </button>
                </div>
                {proofPreviewUrl ? (
                  <img
                    src={proofPreviewUrl}
                    alt="Payment proof preview"
                    className="mt-3 max-h-44 rounded-lg border border-amber-200 object-contain"
                  />
                ) : proofFile ? (
                  <p className="mt-3 text-xs font-semibold">Selected: {proofFile.name}</p>
                ) : null}
                {proofFile ? (
                  <button
                    type="button"
                    onClick={() => selectProofFile(null)}
                    className="mt-2 text-xs font-semibold text-amber-900 underline"
                  >
                    Remove selection
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--muted)] px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={closeProofModal}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!proofFile || submitting}
                onClick={uploadProof}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting
                  ? "Uploading…"
                  : hasUploadedWalletProof(proofTx)
                    ? "Replace proof"
                    : "Submit proof"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <WalletTopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        workspaceType="ecommerce"
        balance={balance}
        onRefresh={refresh}
        onCompleted={(result) => setSuccess(result)}
      />

      <WalletSuccessModal state={success} onClose={() => setSuccess(null)} />
    </div>
  );
}
