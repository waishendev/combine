export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BillplzPaymentOptionTable from '@/components/BillplzPaymentOptionTable'
import { getCurrentUser } from '@/lib/auth'

export default async function BillplzPaymentOptionsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.payment-gateways.view' || perm === 'booking.payment-gateways.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Payment Gateway</span>
        <span className="mx-1">/</span>
        <Link href="/billplz-payment-options" className="text-blue-600 hover:underline">
          Billplz Payment Options
        </Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">Billplz Payment Options</h2>
      <BillplzPaymentOptionTable permissions={user.permissions} />
    </div>
  )
}
