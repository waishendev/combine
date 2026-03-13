import { Service, Staff } from "@/lib/types";

type BookingSummaryProps = {
  service: Service | null;
  staff: Staff | null;
  date: string;
  slotStartAt: string | null;
  submitting: boolean;
  submitError: string | null;
  onConfirmBooking: () => void;
};

const timezone = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
}

function formatTimeLabel(dateTime: string) {
  return new Date(dateTime).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function BookingSummary({
  service,
  staff,
  date,
  slotStartAt,
  submitting,
  submitError,
  onConfirmBooking,
}: BookingSummaryProps) {
  const canSubmit = Boolean(service && staff && slotStartAt) && !submitting;

  return (
    <aside className="h-fit space-y-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-neutral-900">Booking Summary</h2>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-neutral-500">Service</dt>
          <dd className="font-medium text-neutral-900">{service?.name || "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Staff</dt>
          <dd className="font-medium text-neutral-900">{staff?.name || "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Date</dt>
          <dd className="font-medium text-neutral-900">{date ? formatDateLabel(date) : "-"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Time</dt>
          <dd className="font-medium text-neutral-900">{slotStartAt ? formatTimeLabel(slotStartAt) : "-"}</dd>
        </div>
        <div className="border-t border-neutral-200 pt-3">
          <dt className="text-neutral-500">Deposit</dt>
          <dd className="text-lg font-semibold text-amber-700">RM {service?.deposit_amount ?? "-"}</dd>
        </div>
      </dl>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

      <button
        type="button"
        onClick={onConfirmBooking}
        disabled={!canSubmit}
        className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Adding to cart..." : "Confirm booking"}
      </button>
    </aside>
  );
}
