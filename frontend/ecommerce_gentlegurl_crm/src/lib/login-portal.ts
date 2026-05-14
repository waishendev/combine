export type LoginPortal = 'admin' | 'staff'

const PORTAL_COOKIE = 'crm_login_portal'

const readPortalCookie = (): LoginPortal | null => {
  if (typeof document === 'undefined') return null

  const cookieValue = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PORTAL_COOKIE}=`))
    ?.split('=')[1]

  if (!cookieValue) return null

  try {
    const decoded = decodeURIComponent(cookieValue)
    return decoded === 'staff' ? 'staff' : decoded === 'admin' ? 'admin' : null
  } catch {
    return null
  }
}

export function getLoginPortal(): LoginPortal {
  return readPortalCookie() ?? 'admin'
}

export function setLoginPortal(portal: LoginPortal): void {
  if (typeof document === 'undefined') return

  const encoded = encodeURIComponent(portal)
  document.cookie = `${PORTAL_COOKIE}=${encoded}; path=/; max-age=31536000`
}

export function getLoginPagePath(): string {
  return getLoginPortal() === 'staff' ? '/staff/login' : '/admin/login'
}
