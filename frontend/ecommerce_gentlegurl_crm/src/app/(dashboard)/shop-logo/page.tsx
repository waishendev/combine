export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import LogoUploadForm from '@/components/LogoUploadForm'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function ShopLogoPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('ecommerce.settings.view')
  const canEdit = user.permissions.includes('ecommerce.settings.update')

  if (!canView && !canEdit) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4 flex items-center text-gray-500">
        <span>Shop Settings</span>
        <span className="mx-1">/</span>
        <Link href="/shop-logo" className="text-blue-600 hover:underline">
          Upload Logo
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
            Storefront Logo
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Update the logo that appears in the Ecommerce Shop header.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <LogoUploadForm
          canEdit={canEdit}
          title="Ecommerce Shop Logo"
          description="Upload a clean, high-resolution logo for the storefront."
          logoKey="shop_logo_url"
          uploadEndpoint="/api/proxy/ecommerce/branding/shop-logo"
        />

        <LogoUploadForm
          canEdit={canEdit}
          title="Favicon"
          description="Upload a favicon used for browser tabs and bookmarks."
          logoKey="shop_favicon_url"
          uploadEndpoint="/api/proxy/ecommerce/branding/shop-favicon"
          fileLabel="Upload new favicon"
          previewAlt="Favicon preview"
          accept="image/png,image/x-icon,image/vnd.microsoft.icon,.png,.ico"
        />
      </div>
    </div>
  )
}
