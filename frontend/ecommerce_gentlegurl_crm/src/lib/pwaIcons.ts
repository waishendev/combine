import type { Metadata, MetadataRoute } from 'next'

export type BrandingIconMap = Record<string, string | null | undefined> | null | undefined

const FALLBACK_ICON = '/images/logo.png'

export function buildMetadataIcons(icons: BrandingIconMap, fallbackIcon = FALLBACK_ICON): Metadata['icons'] {
  const icon32 = icons?.['32'] ?? icons?.ico ?? fallbackIcon
  const icon64 = icons?.['64'] ?? icon32
  const appleIcon = icons?.['180'] ?? icons?.['192'] ?? icon64

  return {
    icon: [
      ...(icons?.ico ? [{ url: icons.ico, rel: 'icon', type: 'image/x-icon' }] : []),
      { url: icon32, sizes: '32x32', type: 'image/png' },
      { url: icon64, sizes: '64x64', type: 'image/png' },
      { url: appleIcon, sizes: '180x180', type: 'image/png' },
      { url: icons?.['192'] ?? appleIcon, sizes: '192x192', type: 'image/png' },
      { url: icons?.['512'] ?? icons?.['192'] ?? appleIcon, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [icons?.ico ?? icon32],
    apple: [{ url: appleIcon, sizes: '180x180', type: 'image/png' }],
  }
}

export function buildManifestIcons(icons: BrandingIconMap, fallbackIcon = FALLBACK_ICON): MetadataRoute.Manifest['icons'] {
  const icon192 = icons?.['192'] ?? icons?.['180'] ?? icons?.['64'] ?? fallbackIcon
  const icon512 = icons?.['512'] ?? icon192

  return [
    { src: icons?.['32'] ?? icon192, sizes: '32x32', type: 'image/png' },
    { src: icons?.['64'] ?? icon192, sizes: '64x64', type: 'image/png' },
    { src: icons?.['180'] ?? icon192, sizes: '180x180', type: 'image/png', purpose: 'any' },
    { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]
}
