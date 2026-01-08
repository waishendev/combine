export const formatReturnStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";
  const normalized = status.replace(/_/g, " ").toLowerCase();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getReturnStatusBadgeClasses = (status?: string | null) => {
  const base = "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide";
  switch (status?.toLowerCase()) {
    case "requested":
      return `${base} border-yellow-200 bg-yellow-100 text-yellow-700`;
    case "approved":
      return `${base} border-blue-200 bg-blue-100 text-blue-700`;
    case "in_transit":
      return `${base} border-purple-200 bg-purple-100 text-purple-700`;
    case "received":
      return `${base} border-emerald-200 bg-emerald-100 text-emerald-700`;
    case "refunded":
      return `${base} border-green-200 bg-green-100 text-green-700`;
    case "rejected":
      return `${base} border-red-200 bg-red-100 text-red-700`;
    case "cancelled":
      return `${base} border-gray-200 bg-gray-100 text-gray-600`;
    default:
      return `${base} border-[var(--card-border)] bg-[var(--muted)]/40 text-[var(--foreground)]/70`;
  }
};
