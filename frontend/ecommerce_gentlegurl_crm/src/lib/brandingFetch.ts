/**
 * In-flight dedupe for branding GET so pages with multiple LogoUploadForm
 * instances (logo + favicon) share one network round-trip per workspace.
 */
type BrandingPayload = {
  shop_logo_url?: string | null
  crm_logo_url?: string | null
  shop_favicon_url?: string | null
  shop_favicon_icons?: Record<string, string | null> | null
  crm_favicon_url?: string | null
  crm_favicon_icons?: Record<string, string | null> | null
}

type BrandingResponse = {
  data?: BrandingPayload | null
  message?: string | null
  success?: boolean
}

const inflightByType = new Map<string, Promise<BrandingPayload>>()

export async function fetchEcommerceBranding(workspaceType: string): Promise<BrandingPayload> {
  const key = workspaceType || 'ecommerce'
  const existing = inflightByType.get(key)
  if (existing) {
    return existing
  }

  const promise = (async () => {
    const response = await fetch(`/api/proxy/ecommerce/branding?type=${encodeURIComponent(key)}`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error('Failed to load current logo.')
    }
    const payload: BrandingResponse = await response.json().catch(() => ({}))
    return (payload?.data ?? {}) as BrandingPayload
  })().finally(() => {
    inflightByType.delete(key)
  })

  inflightByType.set(key, promise)
  return promise
}
