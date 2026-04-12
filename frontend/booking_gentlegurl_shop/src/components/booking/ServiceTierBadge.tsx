/** Same visual language as booking cart line items. */
export function ServiceTierBadge({ serviceType }: { serviceType: string | null | undefined }) {
  const premium = String(serviceType ?? "").toLowerCase() === "premium";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
        premium
          ? "bg-[var(--accent-strong)] text-white"
          : "border border-[var(--card-border)] bg-[var(--muted)]/60 text-[var(--text-muted)]"
      }`}
      title={premium ? "Premium tier" : "Standard tier"}
    >
      {premium ? <i className="fa-solid fa-crown text-[8px]" aria-hidden /> : null}
      {premium ? "Premium" : "Std"}
    </span>
  );
}
