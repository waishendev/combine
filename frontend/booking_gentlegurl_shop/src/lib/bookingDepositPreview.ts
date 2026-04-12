import type { BookingServiceQuestionOption, Service } from "@/lib/types";

/** Mirrors backend CartController::resolveDepositBreakdownByCartItem for one booking line (before cart). */
export type BookingDepositPreview = {
  depositTotal: number;
  mainDepositApplied: number;
  addonDepositApplied: number;
};

function normalizeTier(t: string | null | undefined): "PREMIUM" | "STANDARD" | null {
  const u = String(t ?? "").toLowerCase();
  if (u === "premium") return "PREMIUM";
  if (u === "standard") return "STANDARD";
  return null;
}

/** Selected options in question / option order (same ordering as cart candidates after main). */
export function getSelectedOptionsInServiceOrder(
  service: Service | null,
  selectedOptionIds: number[]
): BookingServiceQuestionOption[] {
  const set = new Set(selectedOptionIds);
  const out: BookingServiceQuestionOption[] = [];
  for (const q of service?.questions ?? []) {
    for (const opt of q.options ?? []) {
      if (set.has(opt.id)) out.push(opt);
    }
  }
  return out;
}

export function resolveBookingDepositPreview(
  mainServiceType: string | undefined,
  mainDeposit: number,
  selectedOptionsOrdered: Array<{
    id: number;
    linked_service_type?: string | null;
    linked_deposit_amount?: number | null;
  }>
): BookingDepositPreview {
  type Cand = {
    type: "PREMIUM" | "STANDARD";
    deposit: number;
    scope: "main" | "addon";
  };

  const candidates: Cand[] = [];
  const mt = normalizeTier(mainServiceType);
  if (mt) {
    candidates.push({ type: mt, deposit: Math.max(0, Number(mainDeposit) || 0), scope: "main" });
  }

  for (const opt of selectedOptionsOrdered) {
    const lt = normalizeTier(opt.linked_service_type);
    if (!lt) continue;
    candidates.push({
      type: lt,
      deposit: Math.max(0, Number(opt.linked_deposit_amount ?? 0)),
      scope: "addon",
    });
  }

  const premium = candidates.filter((c) => c.type === "PREMIUM");
  let mainDepositApplied = 0;
  let addonDepositApplied = 0;

  if (premium.length > 0) {
    for (const c of premium) {
      if (c.scope === "main") mainDepositApplied += c.deposit;
      else addonDepositApplied += c.deposit;
    }
  } else if (candidates.length > 0) {
    const first = candidates[0];
    if (first.scope === "main") mainDepositApplied = first.deposit;
    else addonDepositApplied = first.deposit;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    depositTotal: round2(mainDepositApplied + addonDepositApplied),
    mainDepositApplied: round2(mainDepositApplied),
    addonDepositApplied: round2(addonDepositApplied),
  };
}

export function depositPreviewForService(
  service: Service | null,
  selectedOptionIds: number[]
): BookingDepositPreview {
  if (!service) {
    return { depositTotal: 0, mainDepositApplied: 0, addonDepositApplied: 0 };
  }
  const ordered = getSelectedOptionsInServiceOrder(service, selectedOptionIds);
  return resolveBookingDepositPreview(service.service_type, Number(service.deposit_amount ?? 0), ordered);
}
