export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import OrdersTable from '@/components/OrdersTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function CompletedOrdersPage() {
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

  // Define initial status filters for Completed Orders
  // Completed Orders should include:
  // - Completed (status: 'completed')
  // - Cancelled (status: 'cancelled', including both refunded and non-refunded)
  // Note: When status includes multiple values (not just 'cancelled'), backend shows all matching orders
  // including cancelled orders with refunded payment_status. When user filters by "Cancelled" only,
  // backend will exclude refunded orders to show only cancelled (non-refunded) orders.
  const initialStatusFilters = {
    status: ['completed', 'cancelled'],
  }

  // Define allowed status options for filter dropdown
  // Only allow filtering by these statuses in Completed Orders page
  const allowedStatusOptions = [
    'Completed',
    'Cancelled',
    'Refunded',
  ]

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Order Management</span>
        <span className="mx-1">/</span>
        <Link
          href="/orders"
          className="text-blue-600 hover:underline"
        >
          Orders
        </Link>
        <span className="mx-1">/</span>
        <Link
          href="/orders/completed"
          className="text-blue-600 hover:underline"
        >
          Completed Orders
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Completed Orders
      </h2>
      <OrdersTable
        permissions={user.permissions}
        initialStatusFilters={initialStatusFilters}
        allowedStatusOptions={allowedStatusOptions}
      />
    </div>
  )
}

