export const formatReturnStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";
  const normalized = status.replace(/_/g, " ").toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getReturnStatusBadgeClasses = (status?: string | null) => {
  const base = "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide";
  switch (status?.toLowerCase()) {
    case "requested":
      return `${base} border-amber-200 bg-amber-100 text-amber-800`;
    case "approved":
      return `${base} border-sky-200 bg-sky-100 text-sky-800`;
    case "in_transit":
      return `${base} border-violet-200 bg-violet-100 text-violet-800`;
    case "received":
      return `${base} border-cyan-200 bg-cyan-100 text-cyan-800`;
    case "refunded":
      return `${base} border-green-200 bg-green-100 text-green-800`;
    case "rejected":
      return `${base} border-rose-200 bg-rose-100 text-rose-800`;
    case "cancelled":
      return `${base} border-gray-300 bg-gray-100 text-gray-700`;
    default:
      return `${base} border-[var(--card-border)] bg-[var(--muted)]/40 text-[var(--foreground)]/70`;
  }
};
