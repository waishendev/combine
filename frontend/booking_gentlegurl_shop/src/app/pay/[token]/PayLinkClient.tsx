"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import InternationalPhoneInput from "@/components/common/InternationalPhoneInput";
import { extractApiError } from "@/lib/auth/redirect";
import { normalizeInternationalPhone } from "@/lib/phone";
import {
  ApiError,
  BillplzPaymentGatewayOption,
  PaymentLinkDetail,
  PaymentLinkServiceBlock,
  PaymentLinkServiceBlockAddon,
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

type PayLinkField =
  | "payer_name"
  | "payer_phone"
  | "payer_email"
  | "payment_method"
  | "bank_account_id"
  | "billplz_gateway_option_id";

const PAY_LINK_FIELD_ORDER: PayLinkField[] = [
  "payer_name",
  "payer_phone",
  "payer_email",
  "payment_method",
  "bank_account_id",
  "billplz_gateway_option_id",
];

function parsePayLinkValidationError(error: unknown): {
  message: string;
  fieldErrors: Partial<Record<PayLinkField, string>>;
  firstField: PayLinkField | null;
} {
  const fieldErrors: Partial<Record<PayLinkField, string>> = {};

  if (error instanceof ApiError) {
    const errors = error.data?.errors;
    if (errors && typeof errors === "object") {
      for (const [key, value] of Object.entries(errors as Record<string, string[] | string>)) {
        const field = key as PayLinkField;
        const msg = Array.isArray(value) ? value[0] : value;
        if (PAY_LINK_FIELD_ORDER.includes(field) && typeof msg === "string" && msg.trim()) {
          fieldErrors[field] = msg;
        }
      }
    }
  }

  const firstField = PAY_LINK_FIELD_ORDER.find((field) => fieldErrors[field]) ?? null;
  const message = firstField && fieldErrors[firstField] ? fieldErrors[firstField]! : extractApiError(error);

  return { message, fieldErrors, firstField };
}

function inputErrorClass(hasError: boolean) {
  return hasError
    ? "border-[var(--status-error,#dc2626)] ring-1 ring-[var(--status-error,#dc2626)]/25"
    : "border-[var(--card-border)]";
}

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const CONTACT_REQUIRED_MESSAGE = "Please provide at least one contact — phone or email.";

function normalizeGatewayKey(key: string): PayMethod | null {
  const normalized =
    key === "billplz_fpx" ? "billplz_online_banking" : key === "billplz_card" ? "billplz_credit_card" : key;
  if (normalized === "manual_transfer" || normalized === "billplz_online_banking" || normalized === "billplz_credit_card") {
    return normalized;
  }
  return null;
}

function parseAppointmentDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAppointmentDate(startAt?: string | null): string {
  const start = parseAppointmentDate(startAt);
  if (!start) return "—";
  return start.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAppointmentTimeRange(startAt?: string | null, endAt?: string | null): string {
  const start = parseAppointmentDate(startAt);
  if (!start) return "—";

  const startTime = start.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  const end = parseAppointmentDate(endAt);
  if (end) {
    const endTime = end.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${startTime} – ${endTime}`;
  }

  return startTime;
}

type PriceBounds = { min: number; max: number; hasRange: boolean };

function serviceBlockPriceBounds(block: PaymentLinkServiceBlock): PriceBounds {
  const mode = String(block.price_mode ?? "fixed").toLowerCase();
  const finalized = block.price_finalized !== false;
  const amount = Number(block.amount ?? 0);
  if (mode === "range" && !finalized && amount <= 0) {
    const rangeMin = Number(block.price_range_min ?? 0);
    const rangeMax = Number(block.price_range_max ?? 0);
    return {
      min: Math.min(rangeMin, rangeMax),
      max: Math.max(rangeMin, rangeMax),
      hasRange: rangeMin > 0 || rangeMax > 0,
    };
  }
  const fixed = amount > 0 ? amount : 0;
  return { min: fixed, max: fixed, hasRange: false };
}

function addonPriceBounds(addon: PaymentLinkServiceBlockAddon): PriceBounds {
  const qty = Math.max(1, Number(addon.quantity ?? 1));
  if (addonIsRangePending(addon)) {
    const rangeMin = Number(addon.price_range_min ?? 0) * qty;
    const rangeMax = Number(addon.price_range_max ?? 0) * qty;
    return {
      min: Math.min(rangeMin, rangeMax),
      max: Math.max(rangeMin, rangeMax),
      hasRange: rangeMin > 0 || rangeMax > 0,
    };
  }
  const line = Number(addon.line_gross_amount ?? Number(addon.extra_price ?? 0) * qty);
  return { min: line, max: line, hasRange: false };
}

function computeApproxTotalBounds(blocks: PaymentLinkServiceBlock[]): PriceBounds {
  let min = 0;
  let max = 0;
  let hasRange = false;

  for (const block of blocks) {
    const serviceBounds = serviceBlockPriceBounds(block);
    min += serviceBounds.min;
    max += serviceBounds.max;
    if (serviceBounds.hasRange || serviceBounds.min !== serviceBounds.max) {
      hasRange = true;
    }

    for (const addon of block.add_ons ?? []) {
      const addonBounds = addonPriceBounds(addon);
      min += addonBounds.min;
      max += addonBounds.max;
      if (addonBounds.hasRange || addonBounds.min !== addonBounds.max) {
        hasRange = true;
      }
    }
  }

  return {
    min: roundMoney(min),
    max: roundMoney(max),
    hasRange: hasRange || Math.abs(min - max) > 0.009,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatApproxTotalPrice(bounds: PriceBounds): string {
  if (bounds.hasRange) {
    return `${formatMoney(bounds.min)} – ${formatMoney(bounds.max)}`;
  }
  return formatMoney(bounds.min);
}

function formatMoney(value?: number | string | null): string {
  return `RM ${Number(value ?? 0).toFixed(2)}`;
}

function formatServicePrice(block: PaymentLinkServiceBlock): string {
  const mode = String(block.price_mode ?? "fixed").toLowerCase();
  const finalized = block.price_finalized !== false;
  const amount = Number(block.amount ?? 0);
  const rangeMin = Number(block.price_range_min ?? 0);
  const rangeMax = Number(block.price_range_max ?? 0);
  if (mode === "range" && !finalized && amount <= 0) {
    if (rangeMin > 0 || rangeMax > 0) {
      return `${formatMoney(Math.min(rangeMin, rangeMax))} – ${formatMoney(Math.max(rangeMin, rangeMax))}`;
    }
    return "Price on consultation";
  }
  return formatMoney(amount);
}

function addonIsRangePending(addon: PaymentLinkServiceBlockAddon): boolean {
  const mode = String(addon.price_mode ?? "").toLowerCase();
  return mode === "range" && addon.price_finalized === false && Number(addon.extra_price ?? 0) <= 0;
}

function formatAddonPrice(addon: PaymentLinkServiceBlockAddon): string {
  const qty = Math.max(1, Number(addon.quantity ?? 1));
  if (addonIsRangePending(addon)) {
    const rangeMin = Number(addon.price_range_min ?? 0) * qty;
    const rangeMax = Number(addon.price_range_max ?? 0) * qty;
    if (rangeMin > 0 || rangeMax > 0) {
      return `${formatMoney(Math.min(rangeMin, rangeMax))} – ${formatMoney(Math.max(rangeMin, rangeMax))}`;
    }
    return "Price on consultation";
  }
  const unit = Number(addon.extra_price ?? 0);
  const line = Number(addon.line_gross_amount ?? unit * qty);
  return formatMoney(line > 0 ? line : unit * qty);
}

function formatAddonDuration(addon: PaymentLinkServiceBlockAddon): string | null {
  const unitMinutes = Number(addon.extra_duration_min ?? 0);
  if (unitMinutes <= 0) return null;
  const qty = Math.max(1, Number(addon.quantity ?? 1));
  return `${unitMinutes * qty} mins`;
}

function ServiceBlockRow({ block }: { block: PaymentLinkServiceBlock }) {
  const addOns = block.add_ons ?? [];
  const isRangePending = String(block.price_mode ?? "").toLowerCase() === "range" && block.price_finalized === false;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3 sm:p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-semibold leading-snug text-[var(--foreground)] sm:text-sm">
            {block.name}
          </p>
          {block.cn_name ? (
            <p className="mt-0.5 break-words text-xs leading-relaxed text-[var(--text-muted)]">{block.cn_name}</p>
          ) : null}
          {Number(block.duration_min ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">{block.duration_min} mins</p>
          ) : null}
        </div>
        <div className="shrink-0 sm:max-w-[48%] sm:text-right">
          <p
            className={`text-sm font-semibold leading-snug tabular-nums sm:text-right ${
              isRangePending ? "text-amber-700" : "text-[var(--foreground)]"
            }`}
          >
            {formatServicePrice(block)}
          </p>
        </div>
      </div>

      {addOns.length > 0 ? (
        <div className="mt-2.5 space-y-2.5 border-t border-[var(--card-border)] pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Add-ons</p>
          {addOns.map((addon, index) => {
            const qty = Math.max(1, Number(addon.quantity ?? 1));
            const priceText = formatAddonPrice(addon);
            const durationText = formatAddonDuration(addon);
            const rangePending = addonIsRangePending(addon);
            return (
              <div
                key={`${addon.id ?? addon.name}-${index}`}
                className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-snug text-[var(--foreground)]">{addon.name}</p>
                  {addon.cn_name ? (
                    <p className="mt-0.5 break-words text-xs leading-relaxed text-[var(--text-muted)]">{addon.cn_name}</p>
                  ) : null}
                  {durationText ? <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{durationText}</p> : null}
                  {qty > 1 ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-muted)]">× {qty}</p>
                  ) : null}
                </div>
                {priceText ? (
                  <p
                    className={`shrink-0 text-sm font-medium leading-snug tabular-nums sm:max-w-[48%] sm:text-right sm:text-xs ${
                      rangePending ? "text-amber-700" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {priceText}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PayLinkField, string>>>({});

  const payerNameRef = useRef<HTMLInputElement>(null);
  const payerPhoneRef = useRef<HTMLDivElement>(null);
  const payerEmailRef = useRef<HTMLInputElement>(null);
  const paymentMethodRef = useRef<HTMLDivElement>(null);
  const bankAccountRef = useRef<HTMLDivElement>(null);
  const onlineBankingRef = useRef<HTMLDivElement>(null);

  const scrollToPayField = useCallback((field: PayLinkField) => {
    const target =
      field === "payer_name"
        ? payerNameRef.current
        : field === "payer_phone"
          ? payerPhoneRef.current
          : field === "payer_email"
            ? payerEmailRef.current
            : field === "payment_method"
              ? paymentMethodRef.current
              : field === "bank_account_id"
                ? bankAccountRef.current
                : onlineBankingRef.current;

    requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLInputElement) {
        target.focus({ preventScroll: true });
      }
    });
  }, []);

  const showFieldError = useCallback(
    (field: PayLinkField, message: string) => {
      setFieldErrors({ [field]: message });
      setFormError(null);
      scrollToPayField(field);
    },
    [scrollToPayField],
  );

  const showContactRequiredError = useCallback(() => {
    setFieldErrors({
      payer_phone: CONTACT_REQUIRED_MESSAGE,
      payer_email: CONTACT_REQUIRED_MESSAGE,
    });
    setFormError(null);
    scrollToPayField("payer_phone");
  }, [scrollToPayField]);

  const clearFieldError = useCallback((field: PayLinkField) => {
    setFieldErrors((prev) => {
      if (prev.payer_phone === CONTACT_REQUIRED_MESSAGE && prev.payer_email === CONTACT_REQUIRED_MESSAGE) {
        return {};
      }
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setFormError(null);
  }, []);

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
      showFieldError("payment_method", "Please choose a payment method.");
      return;
    }
    if (selectedMethod === "manual_transfer" && !selectedBankAccountId) {
      showFieldError("bank_account_id", "Please choose a bank account.");
      return;
    }
    if (!payerName.trim()) {
      showFieldError("payer_name", "Please enter your name.");
      return;
    }

    const normalizedPhone = normalizeInternationalPhone(payerPhone);
    const trimmedEmail = payerEmail.trim();

    if (payerPhone.trim() && !normalizedPhone) {
      showFieldError("payer_phone", "Please enter a complete phone number.");
      return;
    }

    if (!normalizedPhone && !trimmedEmail) {
      showContactRequiredError();
      return;
    }

    if (normalizedPhone && !PHONE_PATTERN.test(normalizedPhone)) {
      showFieldError("payer_phone", "Please enter a valid phone number (8-15 digits, optional + prefix).");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const response = await payPaymentLink(token, {
        payment_method: selectedMethod,
        bank_account_id: selectedMethod === "manual_transfer" ? selectedBankAccountId ?? undefined : undefined,
        billplz_gateway_option_id:
          selectedMethod === "billplz_online_banking" ? selectedOnlineOptionId ?? undefined : undefined,
        payer_name: payerName.trim() || undefined,
        payer_phone: normalizedPhone || undefined,
        payer_email: trimmedEmail || undefined,
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
      const parsed = parsePayLinkValidationError(error);
      const contactApiError =
        parsed.fieldErrors.payer_phone === CONTACT_REQUIRED_MESSAGE ||
        parsed.fieldErrors.payer_email === CONTACT_REQUIRED_MESSAGE ||
        parsed.message === CONTACT_REQUIRED_MESSAGE;

      if (contactApiError) {
        showContactRequiredError();
      } else if (parsed.firstField) {
        setFieldErrors(parsed.fieldErrors);
        setFormError(null);
        scrollToPayField(parsed.firstField);
      } else {
        setFieldErrors({});
        setFormError(parsed.message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    loadLink,
    payerEmail,
    payerName,
    payerPhone,
    scrollToPayField,
    selectedBankAccountId,
    selectedMethod,
    selectedOnlineOptionId,
    showFieldError,
    showContactRequiredError,
    token,
  ]);

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
      setFormError(extractApiError(error));
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
      setFormError(extractApiError(error));
    } finally {
      setUploading(false);
    }
  }, [loadLink, token]);

  const serviceBlocks = link?.appointment?.service_blocks ?? [];
  const approxTotalBounds = useMemo(() => {
    return serviceBlocks.length > 0 ? computeApproxTotalBounds(serviceBlocks) : null;
  }, [serviceBlocks]);
  const showApproxTotal = approxTotalBounds != null && (approxTotalBounds.min > 0 || approxTotalBounds.max > 0);

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

  const hasBlocks = serviceBlocks.length > 0;
  const multiService = Boolean(appointment?.multi_service) || serviceBlocks.length > 1;
  const durationMin = Number(appointment?.estimated_duration_min ?? 0);

  const summaryCard = (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Deposit request</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)] sm:text-3xl">{amountLabel}</p>

      {appointment ? (
        <>
          <div className="mt-4 border-t border-[var(--card-border)] pt-4 text-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Appointment details
            </p>

            {(appointment.staff_name || appointment.booking_code) ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {appointment.staff_name ? (
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Stylist</p>
                    <p className="mt-0.5 break-words font-medium leading-snug text-[var(--foreground)]">
                      {appointment.staff_name}
                    </p>
                  </div>
                ) : null}
                {appointment.booking_code ? (
                  <div className={`min-w-0 ${appointment.staff_name ? "sm:text-right" : ""}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Reference</p>
                    <p className="mt-0.5 break-all font-mono text-xs leading-snug text-[var(--foreground)]">
                      {appointment.booking_code}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Date</p>
                <p className="mt-0.5 font-medium leading-snug text-[var(--foreground)]">
                  {formatAppointmentDate(appointment.start_at)}
                </p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Time</p>
                <p className="mt-0.5 font-medium leading-snug tabular-nums text-[var(--foreground)]">
                  {formatAppointmentTimeRange(appointment.start_at, appointment.end_at)}
                </p>
              </div>
            </div>

            {durationMin > 0 ? (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Duration</p>
                <p className="mt-0.5 font-medium text-[var(--foreground)]">{durationMin} mins</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-[var(--card-border)] pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {multiService ? "Services" : "Service"}
              </p>
              {multiService ? (
                <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  {serviceBlocks.length} services
                </span>
              ) : null}
            </div>

            <div className="space-y-2.5">
              {hasBlocks
                ? serviceBlocks.map((block, index) => (
                    <ServiceBlockRow key={`${block.service_id ?? block.name}-${index}`} block={block} />
                  ))
                : (
                  <div className="rounded-xl border border-[var(--card-border)] bg-[var(--background)]/20 p-3">
                    <p className="break-words font-semibold leading-snug text-[var(--foreground)]">
                      {appointment.service_name}
                    </p>
                  </div>
                )}
            </div>
          </div>

          {showApproxTotal && approxTotalBounds ? (
            <div className="mt-4 flex flex-col gap-1 border-t border-[var(--card-border)] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="text-[var(--text-muted)]">
                {approxTotalBounds.hasRange ? "Approx. total price" : "Total price"}
              </span>
              <span
                className={`font-semibold leading-snug tabular-nums sm:shrink-0 sm:text-right ${
                  approxTotalBounds.hasRange ? "text-amber-700" : "text-[var(--foreground)]"
                }`}
              >
                {formatApproxTotalPrice(approxTotalBounds)}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );

  // Terminal states.
  if (link.status === "PAID") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--status-success,#16a34a)]/30 bg-[var(--card)] p-6 text-center">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Deposit received</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Thank you! Your deposit of {amountLabel} has been confirmed. We look forward to seeing you.
          </p>
        </div>
        {summaryCard}
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
  // Staff rejected the previously uploaded slip — ask the customer to upload a new one.
  const isRejected = link.status === "PENDING" && !slipUploaded && link.manual_review_status === "rejected";
  if (isInReview || isRejected) {
    return (
      <div className="space-y-4">
        {summaryCard}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isRejected ? "bg-rose-100 text-rose-700" : "bg-[var(--muted)]/60 text-[var(--foreground)]"
              }`}
            >
              {isRejected ? "Proof rejected" : "Under review"}
            </span>
          </div>
          <h1 className="mt-3 text-lg font-semibold text-[var(--foreground)]">
            {isRejected ? "Payment proof rejected" : "Payment proof received"}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {isRejected
              ? `Your previous transfer slip could not be verified. Please upload a new, clear slip for your deposit of ${amountLabel}.`
              : `Thank you! We've received your transfer slip and will confirm your deposit of ${amountLabel} shortly.`}
          </p>
          {!isRejected && link.manual_slip_url ? (
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
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {isRejected ? "Upload a new slip" : "Uploaded the wrong slip?"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {isRejected
                ? "Make sure the transfer amount, date, and reference are clearly visible."
                : "You can replace it or remove it and start over."}
            </p>
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
                {uploading ? "Uploading…" : isRejected ? "Upload slip" : "Replace slip"}
              </button>
              {!isRejected ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void cancelProof()}
                  className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/40 disabled:opacity-50"
                >
                  Cancel proof
                </button>
              ) : null}
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

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Pay your deposit</h2>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payer details</p>
          <p className="text-xs text-[var(--text-muted)]">
            Please provide a name and at least one contact detail either a phone number or email address for payment records and communication purposes.
          </p>
          <div>
            <input
              ref={payerNameRef}
              type="text"
              value={payerName}
              onChange={(e) => {
                setPayerName(e.target.value);
                clearFieldError("payer_name");
              }}
              placeholder="Name *"
              className={`w-full rounded-xl border bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)] ${inputErrorClass(Boolean(fieldErrors.payer_name))}`}
            />
            {fieldErrors.payer_name ? (
              <p className="mt-1 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.payer_name}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div ref={payerPhoneRef}>
              <InternationalPhoneInput
                value={payerPhone}
                onChange={(phone) => {
                  setPayerPhone(phone);
                  clearFieldError("payer_phone");
                }}
                placeholder="Phone"
                error={Boolean(fieldErrors.payer_phone)}
              />
              {fieldErrors.payer_phone && fieldErrors.payer_phone !== fieldErrors.payer_email ? (
                <p className="mt-1 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.payer_phone}</p>
              ) : null}
            </div>
            <div>
              <input
                ref={payerEmailRef}
                type="email"
                value={payerEmail}
                onChange={(e) => {
                  setPayerEmail(e.target.value);
                  clearFieldError("payer_email");
                }}
                placeholder="Email"
                className={`w-full rounded-xl border bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--foreground)] ${inputErrorClass(Boolean(fieldErrors.payer_email))}`}
              />
              {fieldErrors.payer_email && fieldErrors.payer_email !== fieldErrors.payer_phone ? (
                <p className="mt-1 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.payer_email}</p>
              ) : null}
            </div>
          </div>
          {fieldErrors.payer_phone &&
          fieldErrors.payer_email &&
          fieldErrors.payer_phone === fieldErrors.payer_email ? (
            <p className="text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.payer_phone}</p>
          ) : null}
        </div>

        <div ref={paymentMethodRef} className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment method</p>
          <div className="space-y-2">
            {paymentOptions.map((option) => (
              <label
                key={option.key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                  selectedMethod === option.key
                    ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/60 ring-2 ring-[var(--accent)]/25"
                    : fieldErrors.payment_method
                      ? "border-[var(--status-error,#dc2626)] bg-[var(--card)]"
                      : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50"
                }`}
              >
                <input
                  type="radio"
                  name="pay_link_method"
                  className="h-4 w-4 accent-[var(--accent-strong,var(--accent))]"
                  checked={selectedMethod === option.key}
                  onChange={() => {
                    setSelectedMethod(option.key);
                    clearFieldError("payment_method");
                  }}
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
          {fieldErrors.payment_method ? (
            <p className="mt-2 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.payment_method}</p>
          ) : null}
        </div>

        {selectedMethod === "manual_transfer" ? (
          <div ref={bankAccountRef} className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Bank account</p>
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <label
                  key={account.id}
                  className={`block cursor-pointer rounded-xl border-2 p-4 text-sm transition-all ${
                    selectedBankAccountId === account.id
                      ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                      : fieldErrors.bank_account_id
                        ? "border-[var(--status-error,#dc2626)] bg-[var(--card)]"
                        : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="radio"
                      name="pay_link_bank"
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong,var(--accent))]"
                      checked={selectedBankAccountId === account.id}
                      onChange={() => {
                        setSelectedBankAccountId(account.id);
                        clearFieldError("bank_account_id");
                      }}
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
            {fieldErrors.bank_account_id ? (
              <p className="mt-2 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.bank_account_id}</p>
            ) : null}
          </div>
        ) : null}

        {selectedMethod === "billplz_online_banking" && onlineBankingOptions.length > 0 ? (
          <div ref={onlineBankingRef} className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Online banking</p>
            <div className="space-y-2">
              {onlineBankingOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm transition-all ${
                    selectedOnlineOptionId === option.id
                      ? "border-[var(--accent-strong,var(--accent))] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20"
                      : fieldErrors.billplz_gateway_option_id
                        ? "border-[var(--status-error,#dc2626)] bg-[var(--card)]"
                        : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="pay_link_online_option"
                    className="h-4 w-4 accent-[var(--accent-strong,var(--accent))]"
                    checked={selectedOnlineOptionId === option.id}
                    onChange={() => {
                      setSelectedOnlineOptionId(option.id);
                      clearFieldError("billplz_gateway_option_id");
                    }}
                  />
                  {option.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.logo_url} alt={option.name} className="h-7 w-7 shrink-0 object-contain" />
                  ) : null}
                  <span className="text-[var(--foreground)]">{option.name}</span>
                </label>
              ))}
            </div>
            {fieldErrors.billplz_gateway_option_id ? (
              <p className="mt-2 text-xs text-[var(--status-error,#dc2626)]">{fieldErrors.billplz_gateway_option_id}</p>
            ) : null}
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
