export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import OrdersTable from '@/components/OrdersTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function OrdersPage() {
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

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Order</span>
        <span className="mx-1">/</span>
        <Link
          href="/orders"
          className="text-blue-600 hover:underline"
        >
          All Orders
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        All Orders
      </h2>
      <OrdersTable
        permissions={user.permissions}
      />
    </div>
  )
}
