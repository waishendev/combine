type CategoryNameStackProps = {
  name?: string | null;
  cnName?: string | null;
  primaryClassName?: string;
  secondaryClassName?: string;
  reserveSecondaryLine?: boolean;
};

export function CategoryNameStack({
  name,
  cnName,
  primaryClassName = "text-sm font-medium text-[var(--foreground)]",
  secondaryClassName = "mt-0.5 text-xs text-[color:var(--text-muted)]",
  reserveSecondaryLine = false,
}: CategoryNameStackProps) {
  const showSecondary = reserveSecondaryLine || Boolean(cnName);

  return (
    <div className="min-w-0 text-left">
      <p className={primaryClassName}>{name || "—"}</p>
      {showSecondary ? (
        <p className={`${secondaryClassName}${cnName ? "" : " invisible"}`} aria-hidden={!cnName}>
          {cnName || "\u00a0"}
        </p>
      ) : null}
    </div>
  );
}

export function formatCategoryOptionLabel(name: string, cnName?: string | null) {
  const trimmedCn = cnName?.trim();
  return trimmedCn ? `${name} / ${trimmedCn}` : name;
}
