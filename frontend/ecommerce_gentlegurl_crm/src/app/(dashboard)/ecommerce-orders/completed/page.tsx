export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import EcommerceOrdersTable from '@/components/EcommerceOrdersTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function EcommerceCompletedOrdersPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.orders.view'
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  await getTranslator(lang)

  const initialStatusFilters = {
    status: ['completed', 'cancelled'],
  }

  const allowedStatusOptions = [
    'Completed',
    'Cancelled',
    'Refunded',
  ]

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Ecommerce Orders</span>
        <span className="mx-1">/</span>
        <Link
          href="/ecommerce-orders/completed"
          className="text-blue-600 hover:underline"
        >
          Completed Orders
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Completed Orders
      </h2>
      <EcommerceOrdersTable
        permissions={user.permissions}
        apiPath="/api/proxy/crm/ecommerce-orders/completed"
        initialStatusFilters={initialStatusFilters}
        allowedStatusOptions={allowedStatusOptions}
      />
    </div>
  )
}
