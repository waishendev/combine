import type { MetadataRoute } from 'next'

import { buildManifestIcons } from '@/lib/pwaIcons'
import { getCrmBranding } from '@/lib/serverCrmBranding'

export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getCrmBranding()
  const name = process.env.NEXT_PUBLIC_APP_NAME || 'Gentlegurls Management App'

  return {
    name,
    short_name: name,
    description: 'Ecommerce administration dashboard',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: buildManifestIcons(branding?.crm_favicon_icons, branding?.crm_favicon_url ?? '/images/logo.png'),
  }
}
