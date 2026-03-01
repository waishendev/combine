export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">GentleGurls</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-black">{title}</h2>
      {subtitle ? <p className="mx-auto mt-3 max-w-2xl text-neutral-600">{subtitle}</p> : null}
    </div>
  );
}
