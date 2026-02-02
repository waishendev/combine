const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url)

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
