import { NextResponse } from 'next/server'

type SameSite = 'strict' | 'lax' | 'none'

/**
 * Read all Set-Cookie values from a fetch Response.
 * Never use headers.get('set-cookie') + split(',') — Expires dates contain commas
 * and undici joins multiple cookies with ", ", which corrupts Laravel session cookies.
 */
export function readSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[]
    raw?: () => Record<string, string[]>
  }

  if (typeof headers.getSetCookie === 'function') {
    const list = headers.getSetCookie()
    if (list.length > 0) return list
  }

  if (typeof headers.raw === 'function') {
    const raw = headers.raw()['set-cookie']
    if (Array.isArray(raw) && raw.length > 0) return raw
  }

  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

/**
 * Forward backend Set-Cookie headers onto a Next.js response for the CRM host.
 * Drops Domain so the cookie binds to the CRM origin (not the API host).
 */
export function forwardSetCookies(from: Response, to: NextResponse): void {
  for (const cookieString of readSetCookieHeaders(from)) {
    const parts = cookieString.split(';').map((part) => part.trim()).filter(Boolean)
    const [nameValue, ...attrParts] = parts
    if (!nameValue) continue

    const eq = nameValue.indexOf('=')
    if (eq <= 0) continue

    const name = nameValue.slice(0, eq).trim()
    const value = nameValue.slice(eq + 1).trim()
    if (!name || value === '') continue

    let httpOnly = false
    let sameSite: SameSite = 'lax'
    let path = '/'
    let maxAge: number | undefined
    let secure = false

    for (const attr of attrParts) {
      const trimmed = attr.toLowerCase()
      if (trimmed === 'httponly') httpOnly = true
      else if (trimmed === 'secure') secure = true
      else if (trimmed.startsWith('samesite=')) {
        const samesiteValue = trimmed.slice('samesite='.length)
        if (samesiteValue === 'strict' || samesiteValue === 'lax' || samesiteValue === 'none') {
          sameSite = samesiteValue
        }
      } else if (trimmed.startsWith('path=')) {
        path = attr.slice('path='.length).trim() || '/'
      } else if (trimmed.startsWith('max-age=')) {
        const parsed = Number.parseInt(trimmed.slice('max-age='.length), 10)
        if (Number.isFinite(parsed)) maxAge = parsed
      }
      // Intentionally ignore Domain — CRM must own the session cookie.
    }

    // Live CRM is HTTPS; Secure sessions must stay Secure when the backend asks for it.
    to.cookies.set(name, value, {
      httpOnly,
      sameSite,
      path,
      secure,
      ...(maxAge !== undefined ? { maxAge } : {}),
    })
  }
}
