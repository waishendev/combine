export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">GentleGurls</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
      {subtitle ? <p className="mx-auto mt-3 max-w-2xl text-[var(--text-muted)]">{subtitle}</p> : null}
    </div>
  );
}
