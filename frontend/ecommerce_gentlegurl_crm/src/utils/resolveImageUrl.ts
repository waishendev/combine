const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url)

/**
 * Paths saved from Laravel `Storage::disk('public')` are served at `/storage/{path}` on the API host.
 */
export function resolvePublicStorageUrl(path: string): string {
  if (!path || path.trim() === '' || path === '-') return ''
  const p = path.trim()
  if (isAbsoluteUrl(p) || p.startsWith('data:')) return p

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''

  if (p.startsWith('/storage/')) {
    if (!base) return p
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
    return `${normalizedBase}${p}`
  }

  const rel = p.replace(/^\/+/, '')
  if (!base) {
    return `/storage/${rel}`
  }
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}/storage/${rel}`
}

export function resolveImageUrl(url: string) {
  if (!url) return ''
  if (isAbsoluteUrl(url) || url.startsWith('data:') || url.startsWith('/')) {
    return url
  }

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    ''

  if (!base) {
    return url
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = url.startsWith('/') ? url : `/${url}`
  return `${normalizedBase}${normalizedPath}`
}
