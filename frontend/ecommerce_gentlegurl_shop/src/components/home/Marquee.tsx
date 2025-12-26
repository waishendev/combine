interface MarqueeProps {
  items: Array<{
    id: number | string;
    text?: string;
  }>;
}

export default function Marquee({ items }: MarqueeProps) {
  const doubledItems = [...(items ?? []), ...(items ?? [])];

  return (
    <div className="relative overflow-hidden border border-white/50 bg-gradient-to-r from-[#0f0f0f] via-[#18181b] to-[#0b0b0b] py-3 text-white shadow-[0_16px_60px_-36px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.18),transparent_35%)]" />
      <div className="flex animate-[marquee_20s_linear_infinite] items-center gap-8 whitespace-nowrap px-6">
        {doubledItems.map((item, index) => (
          <span
            key={`${item.id}-${index}`}
            className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/80"
          >
            <span className="h-px w-6 bg-[var(--card)]/40" aria-hidden />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
