export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import RewardTable from '@/components/RewardTable'
import { getCurrentUser } from '@/lib/auth'

export default async function RewardsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('ecommerce.loyalty.rewards.view')

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Rewards</span>
        <span className="mx-1">/</span>
        <Link href="/rewards" className="text-blue-600 hover:underline">
          Reward List
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Rewards</h2>
      <RewardTable permissions={user.permissions} />
    </div>
  )
}
