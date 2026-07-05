"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  BillplzPaymentGatewayOption,
  PaymentLinkDetail,
  PublicBookingBankAccount,
  cancelPaymentLinkSlip,
  getBillplzPaymentGatewayOptions,
  getBookingBankAccounts,
  getBookingPaymentGateways,
  getPaymentLink,
  payPaymentLink,
  uploadPaymentLinkSlip,
} from "@/lib/apiClient";

type PayMethod = "manual_transfer" | "billplz_online_banking" | "billplz_credit_card";

type PaymentOption = { key: PayMethod; name: string };

function normalizeGatewayKey(key: string): PayMethod | null {
  const normalized =
    key === "billplz_fpx" ? "billplz_online_banking" : key === "billplz_card" ? "billplz_credit_card" : key;
  if (normalized === "manual_transfer" || normalized === "billplz_online_banking" || normalized === "billplz_credit_card") {
    return normalized;
  }
  return null;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PayLinkClient({ token }: { token: string }) {
  const { user } = useAuth();

  const [link, setLink] = useState<PaymentLinkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<PublicBookingBankAccount[]>([]);
  const [onlineBankingOptions, setOnlineBankingOptions] = useState<BillplzPaymentGatewayOption[]>([]);

  const [selectedMethod, setSelectedMethod] = useState<PayMethod | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [selectedOnlineOptionId, setSelectedOnlineOptionId] = useState<number | null>(null);

  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [payerEmail, setPayerEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Manual transfer flow: after "pay", show bank details + slip upload.
  const [manualBank, setManualBank] = useState<PublicBookingBankAccount | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipNote, setSlipNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [slipUploaded, setSlipUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadLink = useCallback(async () => {
    try {
      const detail = await getPaymentLink(token);
      setLink(detail);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Payment link not found.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadLink();
  }, [loadLink]);

  useEffect(() => {
    if (!user) return;
    setPayerName((prev) => prev || user.name || "");
    setPayerPhone((prev) => prev || user.phone || "");
    setPayerEmail((prev) => prev || user.email || "");
  }, [user]);

  // Load payment methods once we know the link is payable.
  useEffect(() => {
    if (!link?.is_payable) return;
    let cancelled = false;
    void Promise.all([
      getBookingPaymentGateways(),
      getBookingBankAccounts(),
      getBillplzPaymentGatewayOptions({ type: "booking", gateway_group: "online_banking" }),
    ])
      .then(([gateways, banks, onlineOptions]) => {
        if (cancelled) return;
        const options = gateways
          .filter((g) => g.is_active !== false)
          .map((g) => {
            const key = normalizeGatewayKey(g.key);
            return key ? { key, name: g.name } : null;
          })
          .filter((o): o is PaymentOption => o !== null);
        // De-duplicate by key (fpx/card normalization can collide).
        const seen = new Set<string>();
        const deduped = options.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)));
        setPaymentOptions(deduped);
        setBankAccounts(banks);
        setOnlineBankingOptions(onlineOptions);
        setSelectedMethod((prev) => prev ?? deduped[0]?.key ?? null);
      })
      .catch(() => {
        if (!cancelled) setFormError("Unable to load payment methods. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, [link?.is_payable]);

  const amountLabel = useMemo(() => `RM ${Number(link?.amount ?? 0).toFixed(2)}`, [link?.amount]);

  const submitPayment = useCallback(async () => {
    if (!selectedMethod) {
      setFormError("Please choose a payment method.");
      return;
    }
    if (selectedMethod === "manual_transfer" && !selectedBankAccountId) {
      setFormError("Please choose a bank account.");
      return;
    }
    if (!payerName.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (!payerPhone.trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await payPaymentLink(token, {
        payment_method: selectedMethod,
        bank_account_id: selectedMethod === "manual_transfer" ? selectedBankAccountId ?? undefined : undefined,
        billplz_gateway_option_id:
          selectedMethod === "billplz_online_banking" ? selectedOnlineOptionId ?? undefined : undefined,
        payer_name: payerName.trim() || undefined,
        payer_phone: payerPhone.trim() || undefined,
        payer_email: payerEmail.trim() || undefined,
      });

      if (response.payment_url) {
        window.location.href = response.payment_url;
        return;
      }

      if (response.requires_slip_upload) {
        setManualBank(response.manual_bank_account ?? null);
        return;
      }

      // Fallback: re-fetch to reflect any status change.
      await loadLink();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Payment could not be started. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [loadLink, payerEmail, payerName, payerPhone, selectedBankAccountId, selectedMethod, selectedOnlineOptionId, token]);

  const submitSlip = useCallback(async () => {
    if (!slipFile) {
      setFormError("Please choose a payment slip file to upload.");
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      await uploadPaymentLinkSlip(token, slipFile, slipNote);
      setSlipFile(null);
      setSlipUploaded(true);
      await loadLink();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Slip upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [loadLink, slipFile, slipNote, token]);

  const cancelProof = useCallback(async () => {
    setUploading(true);
    setFormError(null);
    try {
      await cancelPaymentLinkSlip(token);
      setSlipUploaded(false);
      setSlipFile(null);
      setManualBank(null);
      await loadLink();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not remove the proof. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [loadLink, token]);

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading payment details…</p>;
  }

  if (loadError || !link) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Payment link unavailable</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{loadError ?? "This payment link could not be found."}</p>
      </div>
    );
  }

  const appointment = link.appointment;

  const summaryCard = (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Deposit request</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{amountLabel}</p>
      {appointment ? (
        <div className="mt-4 space-y-1.5 border-t border-[var(--card-border)] pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Service</span>
            <span className="text-right font-medium text-[var(--foreground)]">{appointment.service_name}</span>
          </div>
          {appointment.staff_name ? (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-muted)]">Stylist</span>
              <span className="text-right font-medium text-[var(--foreground)]">{appointment.staff_name}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <span className="text-[var(--text-muted)]">Appointment</span>
            <span className="text-right font-medium text-[var(--foreground)]">{formatDateTime(appointment.start_at)}</span>
          </div>
          {appointment.booking_code ? (
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-muted)]">Reference</span>
              <span className="text-right font-mono text-xs text-[var(--foreground)]">{appointment.booking_code}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // Terminal states.
  if (link.status === "PAID") {
    return (
      <div className="space-y-4">
        {summaryCard}
        <div className="rounded-2xl border border-[var(--status-success,#16a34a)]/30 bg-[var(--card)] p-6 text-center">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Deposit received</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Thank you! Your deposit of {amountLabel} has been confirmed. We look forward to seeing you.
          </p>
        </div>
      </div>
    );
  }

  if (link.status === "CANCELLED" || link.status === "EXPIRED") {
    return (
      <div className="space-y-4">
        {summaryCard}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">
            {link.status === "EXPIRED" ? "Payment link expired" : "Payment link cancelled"}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            This payment link is no longer active. Please contact us for an updated link.
          </p>
        </div>
      </div>
    );
  }

  // Manual transfer: slip uploaded and awaiting review (persists across refresh).
  const isInReview = link.status === "PENDING" && (slipUploaded || link.manual_review_status === "slip_uploaded_pending_review");
  if (isInReview) {
    return (
      <div className="space-y-4">
        {summaryCard}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[var(--muted)]/60 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
              Under review
            </span>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-[var(--foreground)]">Payment proof received</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Thank you! We&apos;ve received your transfer slip and will confirm your deposit of {amountLabel} shortly.
          </p>
          {link.manual_slip_url ? (
            <a
              href={link.manual_slip_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-[var(--accent-strong,var(--accent))] underline"
            >
              View uploaded slip
            </a>
          ) : null}

          <div className="mt-6 border-t border-[var(--card-border)] pt-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Uploaded the wrong slip?</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">You can replace it or remove it and start over.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {formError ? <p className="mt-2 text-sm text-[var(--status-error,#dc2626)]">{formError}</p> : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={uploading || !slipFile}
                onClick={() => void submitSlip()}
                className="flex-1 rounded-xl bg-[var(--accent-strong,var(--accent))] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Replace slip"}
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => void cancelProof()}
                className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/40 disabled:opacity-50"
              >
                Cancel proof
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Manual transfer: bank details + slip upload.
  if (manualBank) {
    return (
      <div className="space-y-4">
        {summaryCard}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Bank transfer details</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Transfer {amountLabel} to the account below, then upload your payment slip.
          </p>
          <div className="mt-4 space-y-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--muted)]/30 p-4 text-sm">
            <p className="font-semibold text-[var(--foreground)]">{manualBank.label || manualBank.bank_name}</p>
            <p className="text-[var(--text-muted)]">{manualBank.bank_name}</p>
            <p className="text-[var(--foreground)]">{manualBank.account_name}</p>
            <p className="font-mono text-[var(--foreground)]">{manualBank.account_number}</p>
            {manualBank.qr_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={manualBank.qr_image_url} alt="Bank QR" className="mt-3 h-40 w-40 rounded bg-white object-contain p-2" />
            ) : null}
            {manualBank.instructions ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{manualBank.instructions}</p>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Upload payment slip</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <input
              type="text"
              value={slipNote}
              onChange={(e) => setSlipNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)]"
            />
            {formError ? <p className="text-sm text-[var(--status-error,#dc2626)]">{formError}</p> : null}
            <button
              type="button"
              disabled={uploading || !slipFile}
              onClick={() => void submitSlip()}
              className="w-full rounded-xl bg-[var(--accent-strong,var(--accent))] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload slip"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: payment form.
  return (
    <div className="space-y-4">
      {summaryCard}

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Pay your deposit</h2>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Your details</p>
          <input
            type="text"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Name *"
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)]"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="tel"
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              placeholder="Phone *"
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)]"
            />
            <input
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)]"
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment method</p>
          <div className="space-y-2">
            {paymentOptions.map((option) => (
              <label
                key={option.key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  selectedMethod === option.key
                    ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/60 ring-2 ring-[var(--accent)]/25"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                }`}
              >
                <input
                  type="radio"
                  name="pay_link_method"
                  className="h-4 w-4 accent-[var(--accent-strong,var(--accent))]"
                  checked={selectedMethod === option.key}
                  onChange={() => setSelectedMethod(option.key)}
                />
                <span className="text-[var(--foreground)]">{option.name}</span>
              </label>
            ))}
            {paymentOptions.length === 0 ? (
              <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                No payment methods are available right now.
              </p>
            ) : null}
          </div>
        </div>

        {selectedMethod === "manual_transfer" ? (
          <div className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Bank account</p>
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <label
                  key={account.id}
                  className={`block cursor-pointer rounded-xl border-2 p-4 text-sm transition-all ${
                    selectedBankAccountId === account.id
                      ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                      : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="pay_link_bank"
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong,var(--accent))]"
                      checked={selectedBankAccountId === account.id}
                      onChange={() => setSelectedBankAccountId(account.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--foreground)]">{account.label || account.bank_name}</p>
                      <p className="text-[var(--text-muted)]">{account.bank_name}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {account.account_name} · {account.account_number}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
              {bankAccounts.length === 0 ? (
                <p className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  No bank accounts configured.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {selectedMethod === "billplz_online_banking" && onlineBankingOptions.length > 0 ? (
          <div className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Online banking</p>
            <div className="space-y-2">
              {onlineBankingOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-all ${
                    selectedOnlineOptionId === option.id
                      ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                      : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="pay_link_online_option"
                    className="h-4 w-4 accent-[var(--accent-strong,var(--accent))]"
                    checked={selectedOnlineOptionId === option.id}
                    onChange={() => setSelectedOnlineOptionId(option.id)}
                  />
                  {option.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.logo_url} alt={option.name} className="h-7 w-7 shrink-0 object-contain" />
                  ) : null}
                  <span className="text-[var(--foreground)]">{option.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {formError ? <p className="mt-4 text-sm text-[var(--status-error,#dc2626)]">{formError}</p> : null}

        <button
          type="button"
          disabled={submitting || paymentOptions.length === 0}
          onClick={() => void submitPayment()}
          className="mt-5 w-full rounded-xl bg-[var(--accent-strong,var(--accent))] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Processing…" : `Pay ${amountLabel}`}
        </button>
      </div>
    </div>
  );
}
