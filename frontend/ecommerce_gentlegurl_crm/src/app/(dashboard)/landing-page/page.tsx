export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import EcommerceLandingPageEditor from '@/components/ecommerce/EcommerceLandingPageEditor'
import { getCurrentUser } from '@/lib/auth'

export default async function EcommerceLandingPageSettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const canView = user.permissions.includes('ecommerce.landing-page.view')
  const canUpdate = user.permissions.includes('ecommerce.landing-page.update')

  if (!canView && !canUpdate) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Marketing</span>
        <span className="mx-1">/</span>
        <Link href="/landing-page" className="text-blue-600 hover:underline">
          Ecommerce Landing Page
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-2">Ecommerce Landing Page</h2>
      <p className="mb-6 text-sm text-gray-500">
        Homepage content for the ecommerce shop: slider headline, hero copy below slides, and Visit Our Studio at the bottom.
      </p>

      <EcommerceLandingPageEditor canEdit={canUpdate} />
    </div>
  )
}
