export function BookingProgress({ step }: { step: number }) {
  const steps = ["CATEGORY", "SERVICE", "ADD-ONS", "DATE & TIME", "STYLIST", "CHECKOUT"];
  const activeStep = Math.min(Math.max(step, 1), steps.length);

  return (
    <div className="mb-10 flex items-center justify-center gap-2 px-5 sm:gap-3">
      {steps.map((label, index) => {
        const num = index + 1;
        const isDone = num < activeStep;
        const isActive = num === activeStep;
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
