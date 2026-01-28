export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import LogoUploadForm from '@/components/LogoUploadForm'
import { getCurrentUser } from '@/lib/auth'
import type { LangCode } from '@/lib/i18n'
import { getTranslator } from '@/lib/i18n-server'

export default async function CrmLogoPage() {
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
        <span>Settings</span>
        <span className="mx-1">/</span>
        <Link href="/crm-logo" className="text-blue-600 hover:underline">
          Upload Logo (CRM)
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
            CRM Header Logo
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Update the logo shown in the CRM header for staff.
          </p>
        </div>
      </div>

      <LogoUploadForm
        canEdit={canEdit}
        title="CRM Logo"
        description="Upload a logo for the Ecommerce CRM header."
        logoKey="crm_logo_url"
        uploadEndpoint="/api/proxy/ecommerce/branding/crm-logo"
      />
    </div>
  )
}
