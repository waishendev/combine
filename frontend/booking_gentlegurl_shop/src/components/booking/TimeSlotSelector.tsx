import { BookingSlot } from "@/lib/types";

type TimeSlotSelectorProps = {
  slots: BookingSlot[];
  selectedSlotStartAt: string | null;
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onRefreshSlots: () => void;
  onSelectSlot: (slotStartAt: string) => void;
};

const timezone = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

const formatTime = (dateTime: string) =>
  new Date(dateTime).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

export function TimeSlotSelector({
  slots,
  selectedSlotStartAt,
  loading,
  error,
  disabled,
  onRefreshSlots,
  onSelectSlot,
}: TimeSlotSelectorProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white/90 p-6 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 4</p>
          <h2 className="mt-1 text-2xl font-medium text-neutral-900">Choose your time</h2>
        </div>
        <button
          type="button"
          onClick={onRefreshSlots}
          disabled={disabled}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Load slots
        </button>
      </div>

      {loading ? <p className="text-sm text-neutral-500">Loading available slots...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => {
          const startAt = slot.start_at ?? slot.start_time;
          const endAt = slot.end_at ?? slot.end_time;
          if (!startAt || !endAt) {
            return null;
          }

          const isActive = selectedSlotStartAt === startAt;

          return (
            <button
              type="button"
              key={`${startAt}-${endAt}`}
              onClick={() => onSelectSlot(startAt)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              <p className="text-sm font-semibold">{formatTime(startAt)}</p>
              <p className={`text-sm ${isActive ? "text-white/80" : "text-neutral-500"}`}>to {formatTime(endAt)}</p>
            </button>
          );
        })}
      </div>

      {!loading && slots.length === 0 ? <p className="text-sm text-neutral-500">No slots available for this date.</p> : null}
    </section>
  );
}
