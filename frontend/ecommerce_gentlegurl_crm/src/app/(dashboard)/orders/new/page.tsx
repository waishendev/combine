export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import OrdersTable from '@/components/OrdersTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function NewOrdersPage() {
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

  // Define initial status filters for New Orders
  // New Orders should include:
  // - Awaiting Payment (status: 'pending', payment_status: 'unpaid')
  // - Waiting for Verification (status: 'processing', payment_status: 'unpaid')
  // - Payment Proof Rejected (status: 'reject_payment_proof', payment_status: 'unpaid')
  // - Preparing (status: 'processing', payment_status: 'paid')
  // - Ready for Pickup (status: 'ready_for_pickup', payment_status: 'paid')
  // - Shipped (status: 'shipped', any payment_status)
  const initialStatusFilters = {
    status: ['pending', 'processing', 'reject_payment_proof', 'ready_for_pickup', 'shipped'],
    payment_status: ['unpaid', 'paid'],
  }

  // Define allowed status options for filter dropdown
  // Only allow filtering by these statuses in New Orders page
  const allowedStatusOptions = [
    'Awaiting Payment',
    'Waiting for Verification',
    'Payment Proof Rejected',
    'Preparing',
    'Ready for Pickup',
    'Shipped',
  ]

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Order</span>
        <span className="mx-1">/</span>
        <Link
          href="/orders"
          className="text-blue-600 hover:underline"
        >
          Orders
        </Link>
        <span className="mx-1">/</span>
        <Link
          href="/orders/new"
          className="text-blue-600 hover:underline"
        >
          New Orders
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        New Orders
      </h2>
      <OrdersTable
        permissions={user.permissions}
        initialStatusFilters={initialStatusFilters}
        allowedStatusOptions={allowedStatusOptions}
      />
    </div>
  )
}

