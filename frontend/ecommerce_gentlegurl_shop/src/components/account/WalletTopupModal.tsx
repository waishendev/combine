"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCustomerWalletTopup,
  getBillplzPaymentGatewayOptions,
  getCustomerWalletPaymentGateways,
  uploadCustomerWalletPaymentProof,
  type BillplzPaymentGatewayOption,
  type CustomerWalletBankAccount,
  type CustomerWalletGateway,
  type CustomerWalletTransaction,
} from "@/lib/apiClient";
import { bankQrImageCompactClass, BANK_QR_IMAGE_HEIGHT, BANK_QR_IMAGE_WIDTH } from "@/lib/bankQrImage";
import { walletMoney } from "@/lib/walletUi";
import type { WalletSuccessState } from "@/components/account/WalletSuccessModal";

type TopupStep = 1 | 2;

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceType: "ecommerce" | "booking";
  balance: string;
  onCompleted?: (result: WalletSuccessState) => void;
  onRefresh?: () => void | Promise<void>;
};

const quickAmounts = [20, 50, 100, 200];

export default function WalletTopupModal({
  open,
  onClose,
  workspaceType,
  balance,
  onCompleted,
  onRefresh,
}: Props) {
  const [gateways, setGateways] = useState<CustomerWalletGateway[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CustomerWalletBankAccount[]>([]);
  const [onlineBankingOptions, setOnlineBankingOptions] = useState<BillplzPaymentGatewayOption[]>([]);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [selectedBillplzGatewayOptionId, setSelectedBillplzGatewayOptionId] = useState<number | null>(null);
  const [amount, setAmount] = useState("50");
  const [topupStep, setTopupStep] = useState<TopupStep>(1);
  const [pendingTopup, setPendingTopup] = useState<CustomerWalletTransaction | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofCaptureMode, setProofCaptureMode] = useState<"environment" | "user" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedGatewayRecord = gateways.find((gateway) => gateway.key === selectedGateway) ?? null;
  const selectedBank = bankAccounts.find((bank) => bank.id === selectedBankAccountId) ?? null;
  const isManual = selectedGateway === "manual_transfer";
  const isOnlineBanking = selectedGateway === "billplz_online_banking";
  const isCreditCard = selectedGateway === "billplz_credit_card";
  const isBillplz = isOnlineBanking || isCreditCard;
  const topupAmount = Number(amount || 0);

  const resetState = useCallback(() => {
    setTopupStep(1);
    setPendingTopup(null);
    setProofFile(null);
    setProofPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProofCaptureMode(null);
    setError(null);
    setAmount("50");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [gatewayPayload, onlineOptions] = await Promise.all([
        getCustomerWalletPaymentGateways(workspaceType),
        getBillplzPaymentGatewayOptions({ type: workspaceType, gateway_group: "online_banking" }).catch(() => []),
      ]);
      setGateways(gatewayPayload.payment_gateways);
      setBankAccounts(gatewayPayload.bank_accounts);
      setOnlineBankingOptions(onlineOptions);
      setSelectedGateway(
        gatewayPayload.payment_gateways.find((gateway) => gateway.key === "manual_transfer")?.key ||
          gatewayPayload.payment_gateways[0]?.key ||
          "",
      );
      setSelectedBankAccountId(
        gatewayPayload.bank_accounts.find((bank) => bank.is_default)?.id ??
          gatewayPayload.bank_accounts[0]?.id ??
          null,
      );
      setSelectedBillplzGatewayOptionId(
        onlineOptions.find((option) => option.is_default)?.id ?? onlineOptions[0]?.id ?? null,
      );
    } catch {
      setError("Unable to load payment methods. Please try again.");
    } finally {
      setLoadingOptions(false);
    }
  }, [workspaceType]);

  useEffect(() => {
    if (!open) return;
    resetState();
    void loadOptions();
  }, [open, loadOptions, resetState]);

  if (!open) return null;

  const handleClose = () => {
    resetState();
    onClose();
  };

  const submitTopup = async () => {
    setError(null);
    if (!selectedGatewayRecord) {
      setError("No payment method selected.");
      return;
    }
    if (!Number.isFinite(topupAmount) || topupAmount <= 0) {
      setError("Enter a valid top-up amount.");
      return;
    }
    if (isManual && !selectedBankAccountId) {
      setError("Please select a bank account for manual transfer.");
      return;
    }
    if (isOnlineBanking && onlineBankingOptions.length > 0 && !selectedBillplzGatewayOptionId) {
      setError("Please select an online banking option.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await createCustomerWalletTopup({
        amount,
        payment_gateway_key: selectedGateway,
        payment_method_label: selectedGatewayRecord.name,
        workspace_type: workspaceType,
        bank_account_id: isManual ? selectedBankAccountId ?? undefined : undefined,
        billplz_gateway_option_id: isOnlineBanking ? selectedBillplzGatewayOptionId ?? undefined : undefined,
      });

      const topup = response.data?.topup ?? null;
      const paymentUrl = response.data?.payment_url ?? null;
      setPendingTopup(topup);
      await onRefresh?.();

      if (isBillplz) {
        if (!paymentUrl) {
          setError("Unable to open Billplz payment. Please try again.");
          return;
        }
        window.location.href = paymentUrl;
        return;
      }

      setTopupStep(2);
    } catch (err) {
      const apiMessage =
        err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : null;
      setError(apiMessage || "Unable to submit top-up request. Please check the amount and payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectProofFile = (file: File | null) => {
    setProofPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
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
    if (!pendingTopup || !proofFile) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCustomerWalletPaymentProof(pendingTopup.id, proofFile);
      await onRefresh?.();
      handleClose();
      onCompleted?.({
        variant: "proof_submitted",
        amount: pendingTopup.amount,
        reference: pendingTopup.transaction_no,
      });
    } catch {
      setError("Payment proof upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const continueLabel = (() => {
    if (submitting) {
      if (isBillplz) return "Opening Billplz…";
      return "Creating request…";
    }
    if (isBillplz) return "Proceed to Billplz";
    return "Continue to transfer";
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-0 backdrop-blur-sm sm:items-center sm:px-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-xl border border-[var(--input-border)] bg-[var(--input-bg)] shadow-xl sm:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--muted)] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--accent-strong)]">
              {topupStep === 1 ? "Top Up Balance" : "Transfer & Upload Proof"}
            </h3>
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                  {topupStep === 1 ? (
                    <>
                      Current balance{" "}
                      <span className="font-semibold text-[var(--foreground)]">{walletMoney(balance)}</span>
                    </>
                  ) : (
                    "Transfer the amount below, then upload your proof"
                  )}
                </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          {topupStep === 1 ? (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(String(value))}
                      className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition ${
                        Number(amount) === value
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--input-border)] text-[var(--accent-strong)] hover:bg-[var(--background-soft)]"
                      }`}
                    >
                      RM{value}
                    </button>
                  ))}
                </div>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-3 w-full rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  placeholder="Custom amount"
                  inputMode="decimal"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Payment Method
                </p>
                {loadingOptions ? (
                  <p className="rounded-lg border border-dashed border-[var(--input-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    Loading payment methods…
                  </p>
                ) : gateways.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--input-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    No payment methods are currently available. Please contact the salon.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {gateways.map((gateway) => (
                      <label
                        key={gateway.key}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                          selectedGateway === gateway.key
                            ? "border-[var(--accent-strong)] bg-[var(--background-soft)]"
                            : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="wallet_payment_method"
                          className="h-4 w-4 accent-[var(--accent-strong)]"
                          checked={selectedGateway === gateway.key}
                          onChange={() => setSelectedGateway(gateway.key)}
                        />
                        <span>{gateway.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {isManual ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Bank Account
                  </p>
                  {bankAccounts.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--input-border)] px-4 py-4 text-sm text-[var(--text-muted)]">
                      No bank account is configured for manual transfer.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bankAccounts.map((bank) => (
                        <label
                          key={bank.id}
                          className={`block cursor-pointer rounded-lg border p-4 text-sm transition ${
                            selectedBankAccountId === bank.id
                              ? "border-[var(--accent-strong)] bg-[var(--background-soft)]"
                              : "border-[var(--card-border)] bg-[var(--card)]"
                          }`}
                        >
                          <div className="flex gap-3">
                            <input
                              type="radio"
                              className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
                              checked={selectedBankAccountId === bank.id}
                              onChange={() => setSelectedBankAccountId(bank.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[var(--accent-stronger)]">
                                {bank.label || bank.bank_name}
                              </p>
                              <p className="mt-0.5 text-[var(--text-muted)]">{bank.bank_name}</p>
                              <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {bank.account_name} · {bank.account_number || bank.account_no}
                              </p>
                              {bank.qr_image_url ? (
                                <img
                                  src={bank.qr_image_url}
                                  alt={`${bank.bank_name} QR`}
                                  width={BANK_QR_IMAGE_WIDTH}
                                  height={BANK_QR_IMAGE_HEIGHT}
                                  className={bankQrImageCompactClass}
                                />
                              ) : null}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-[var(--text-muted)]">
                    Next step: transfer the amount, then upload your payment proof.
                  </p>
                </div>
              ) : null}

              {isOnlineBanking ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Online Banking
                  </p>
                  {onlineBankingOptions.length === 0 ? (
                    <p className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                      No banks configured yet. We&apos;ll continue with Billplz generic online banking flow.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {onlineBankingOptions.map((option) => (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                            selectedBillplzGatewayOptionId === option.id
                              ? "border-[var(--accent-strong)] bg-[var(--background-soft)]"
                              : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name="wallet_billplz_online_option"
                            className="h-4 w-4 accent-[var(--accent-strong)]"
                            checked={selectedBillplzGatewayOptionId === option.id}
                            onChange={() => setSelectedBillplzGatewayOptionId(option.id)}
                          />
                          {option.logo_url ? (
                            <img src={option.logo_url} alt={option.name} className="h-7 w-7 shrink-0 object-contain" />
                          ) : (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/30 text-[11px] font-semibold text-[var(--text-muted)]">
                              {option.name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                          )}
                          <span>{option.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {isCreditCard ? (
                <p className="rounded-lg bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  You will be redirected to Billplz to complete your credit card payment securely.
                </p>
              ) : null}

              <div className="rounded-lg border border-[var(--input-border)] bg-[var(--background-soft)]/80 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Current Balance</span>
                  <strong className="tabular-nums">{walletMoney(balance)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-[var(--text-muted)]">Top Up Amount</span>
                  <strong className="tabular-nums">{walletMoney(topupAmount)}</strong>
                </div>
                <div className="mt-2 flex justify-between gap-3 border-t border-[var(--muted)] pt-2">
                  <span className="font-medium text-[var(--accent-stronger)]">After successful top up</span>
                  <strong className="tabular-nums text-[var(--accent-stronger)]">
                    {walletMoney(Number(balance) + (Number.isFinite(topupAmount) ? topupAmount : 0))}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--background-soft)] px-5 py-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-strong)]">
                  Amount to transfer
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-[var(--accent-stronger)]">
                  {walletMoney(pendingTopup?.amount ?? topupAmount)}
                </p>
                {/* {pendingTopup?.transaction_no ? (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">Ref: {pendingTopup.transaction_no}</p>
                ) : null} */}
              </div>

              <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card)] p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Transfer details
                </p>
                <p className="mt-2 font-semibold text-[var(--accent-stronger)]">
                  {selectedBank?.label || selectedBank?.bank_name || "Selected bank"}
                </p>
                <p className="mt-1 text-[var(--text-muted)]">{selectedBank?.bank_name}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {selectedBank?.account_name} · {selectedBank?.account_number || selectedBank?.account_no}
                </p>
                {selectedBank?.instructions ? (
                  <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{selectedBank.instructions}</p>
                ) : null}
                {selectedBank?.qr_image_url ? (
                  <img
                    src={selectedBank.qr_image_url}
                    alt={`${selectedBank.bank_name} QR`}
                    width={BANK_QR_IMAGE_WIDTH}
                    height={BANK_QR_IMAGE_HEIGHT}
                    className={`${bankQrImageCompactClass} mt-4`}
                  />
                ) : null}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Upload payment proof</p>
                <p className="mt-1 text-amber-900/90">
                  After transferring, upload a screenshot or receipt so staff can verify and credit your balance.
                </p>
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
                    Remove proof
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--muted)] px-5 py-4 sm:px-6">
          {topupStep === 2 ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)]"
              >
                Do later
              </button>
              <button
                type="button"
                disabled={!proofFile || submitting || !pendingTopup}
                onClick={uploadProof}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Uploading…" : "Submit proof"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--accent-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || loadingOptions || gateways.length === 0}
                onClick={submitTopup}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {continueLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
