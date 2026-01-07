export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import PaymentGatewayTable from '@/components/PaymentGatewayTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function PaymentGatewaysPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has permission to view payment gateways
  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.payment-gateways.view'
  )
  
  if (!hasPermission) {
    redirect('/dashboard')
  }

  // Default to EN for now, can be extended later for multi-language support
  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Payment Gateway</span>
        <span className="mx-1">/</span>
        <Link
          href="/payment-gateways"
          className="text-blue-600 hover:underline"
        >
          Payment Gateways
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Payment Gateways
      </h2>
      <PaymentGatewayTable
        permissions={user.permissions}
      />
    </div>
  )
}

