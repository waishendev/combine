export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import PosPaymentMethodSettings from '@/components/pos/PosPaymentMethodSettings'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: 'POS Payment Methods' }

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const canView = user.permissions.includes('pos.payment-method-settings.view')
  const canUpdate = user.permissions.includes('pos.payment-method-settings.update')
  if (!canView && !canUpdate) redirect('/dashboard')

  return (
    <div className="crm-page-shell px-10 py-6">
      <div className="mb-4 flex items-center text-xs text-gray-500">
        <span>Settings</span>
        <span className="mx-1">/</span>
        <Link href="/pos/settings/payment-methods" className="text-blue-600 hover:underline">
          POS Payment Methods
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold leading-tight text-slate-900">POS Payment Methods</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose which tender types appear at POS checkout for the selected Branch, and set their display order.
        </p>
      </div>
      <PosPaymentMethodSettings canUpdate={canUpdate} />
    </div>
  )
}
