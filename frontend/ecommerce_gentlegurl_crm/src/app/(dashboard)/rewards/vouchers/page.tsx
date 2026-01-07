export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import RewardVoucherTable from '@/components/RewardVoucherTable'
import { getCurrentUser } from '@/lib/auth'

export default async function RewardVoucherPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.vouchers.view'
  )
  
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Marketing</span>
        <span className="mx-1">/</span>
        <span className="text-gray-500">Rewards</span>
        <span className="mx-1">/</span>
        <Link
          href="/rewards/vouchers"
          className="text-blue-600 hover:underline"
        >
          Vouchers
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Reward Vouchers
      </h2>
      <RewardVoucherTable permissions={user.permissions} />
    </div>
  )
}
