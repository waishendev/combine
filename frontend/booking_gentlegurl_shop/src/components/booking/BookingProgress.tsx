/** Date & time before stylist: pick a slot first, then an available staff member. Checkout is via cart icon, not a wizard step. */
const STEP_LABELS = ["CATEGORY", "SERVICE", "ADD-ONS", "DATE & TIME", "STYLIST"];

type BookingProgressProps = {
  step: number;
  /** When true, shows a skeleton instead of step numbers (avoids 1→2 flicker while data loads). */
  loading?: boolean;
};

export function BookingProgress({ step, loading }: BookingProgressProps) {
  const steps = STEP_LABELS;
  const activeStep = Math.min(Math.max(step, 1), steps.length);

  if (loading) {
    return (
      <div
        className="mb-10 flex items-center justify-center gap-2 px-5 sm:gap-3"
        aria-busy="true"
        aria-label="Loading booking steps"
      >
        {steps.map((_, index) => (
          <div key={steps[index]} className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex flex-col items-center">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--muted)]" />
              <div className="mt-2 hidden h-3 w-14 max-w-[3.5rem] animate-pulse rounded bg-[var(--muted)] sm:block" />
            </div>
            {index < steps.length - 1 && (
              <div className="h-[1.5px] w-12 shrink-0 animate-pulse bg-[var(--card-border)] sm:w-14" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-10 flex items-center justify-center gap-2 px-5 sm:gap-3">
      {steps.map((label, index) => {
        const num = index + 1;
        const isDone = num < activeStep;
        const isActive = num === activeStep;
        const isUpcoming = num > activeStep;
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? "bg-[var(--accent-strong)] text-white shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.08)]"
                    : isDone
                      ? "bg-[var(--accent-strong)] text-white"
                      : "border-[1.5px] border-[var(--card-border)] bg-transparent text-[var(--text-muted)]"
                }`}
              >
                {isDone ? "✓" : num}
              </div>
              <span
                className={`mt-2 hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-wider sm:block ${
                  isActive ? "text-[var(--foreground)]" : isDone ? "text-[var(--accent-strong)]" : "text-[var(--text-muted)]"
                }`}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-[1.5px] w-12 shrink-0 sm:w-14 ${
                  isDone ? "bg-[var(--accent-strong)]" : "bg-[var(--card-border)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
