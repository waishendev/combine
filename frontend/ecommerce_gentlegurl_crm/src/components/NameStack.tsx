type NameStackProps = {
  name?: string | null
  cnName?: string | null
  primaryClassName?: string
  secondaryClassName?: string
  fallback?: string
}

export function NameStack({
  name,
  cnName,
  primaryClassName = 'font-medium text-gray-900',
  secondaryClassName = 'mt-0.5 text-xs text-gray-500',
  fallback = '—',
}: NameStackProps) {
  const displayCnName = cnName?.trim()

  return (
    <div className="min-w-0">
      <p className={primaryClassName}>{name?.trim() || fallback}</p>
      {displayCnName ? <p className={secondaryClassName}>{displayCnName}</p> : null}
    </div>
  )
}

type VariantNameStackProps = {
  name?: string | null
  cnName?: string | null
  labelClassName?: string
  nameClassName?: string
  cnClassName?: string
  fallback?: string
}

export function VariantNameStack({
  name,
  cnName,
  labelClassName = 'text-xs text-gray-500',
  nameClassName = 'text-sm text-gray-900',
  cnClassName = 'text-xs text-gray-500',
  fallback = '—',
}: VariantNameStackProps) {
  const displayName = name?.trim()
  const displayCnName = cnName?.trim()

  if (!displayName && !displayCnName) {
    return <p className={nameClassName}>{fallback}</p>
  }

  return (
    <div className="min-w-0">
      {displayName ? (
        <p className={nameClassName}>
          <span className={labelClassName}>Variant: </span>
          {displayName}
        </p>
      ) : null}
      {displayCnName ? <p className={displayName ? cnClassName : nameClassName}>{displayCnName}</p> : null}
    </div>
  )
}
