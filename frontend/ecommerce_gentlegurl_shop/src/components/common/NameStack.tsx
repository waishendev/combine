type NameStackProps = {
  name?: string | null;
  cnName?: string | null;
  className?: string;
  nameClassName?: string;
  cnClassName?: string;
};

export function NameStack({
  name,
  cnName,
  className = "",
  nameClassName = "text-sm font-semibold text-[var(--foreground)]",
  cnClassName = "mt-0.5 text-xs text-[color:var(--text-muted)]",
}: NameStackProps) {
  return (
    <div className={className}>
      <p className={nameClassName}>{name || "—"}</p>
      {cnName ? <p className={cnClassName}>{cnName}</p> : null}
    </div>
  );
}

type VariantNameBlockProps = {
  label?: string;
  name?: string | null;
  cnName?: string | null;
  sku?: string | null;
  align?: "left" | "right";
};

export function VariantNameBlock({
  label = "Variant",
  name,
  cnName,
  sku,
  align = "left",
}: VariantNameBlockProps) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <div className={`mt-1 ${alignClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--foreground)]/50">{label}</p>
      <NameStack
        name={name}
        cnName={cnName}
        nameClassName="text-xs font-medium text-[var(--foreground)]"
        cnClassName="mt-0.5 text-[11px] text-[color:var(--text-muted)]"
      />
      {sku ? <p className="mt-0.5 break-all text-[11px] font-mono text-[var(--foreground)]/50">{sku}</p> : null}
    </div>
  );
}
