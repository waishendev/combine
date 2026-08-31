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
    (perm) =>
      perm === 'ecommerce.billplz-payment-gateways.view' ||
      perm === 'booking.billplz-payment-gateways.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Payment Gateway</span>
        <span className="mx-1">/</span>
        <Link href="/billplz-payment-options" className="text-blue-600 hover:underline">
          Billplz Payment Options
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Billplz Payment Options</h2>
      <BillplzPaymentOptionTable permissions={user.permissions} />
    </div>
  )
}
