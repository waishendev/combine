import { cookies } from 'next/headers'

export type CrmBranding = {
  crm_favicon_url?: string | null
  crm_favicon_icons?: Record<string, string | null> | null
}

export async function getCrmBranding(): Promise<CrmBranding | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) {
      return null
    }

    const ck = await cookies()
    const cookieHeader = ck
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    const response = await fetch(`${baseUrl}/api/ecommerce/branding`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    return payload?.data ?? null
  } catch {
    return null
  }
}
