export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PromotionManagement from '@/components/PromotionManagement'
import { getCurrentUser } from '@/lib/auth'

export default async function PromotionsPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (!user.permissions.includes('ecommerce.promotions.view')) redirect('/dashboard')

  return (
    <div className="overflow-y-auto py-6 px-10">
      <h2 className="text-3xl font-semibold mb-6">Promotions</h2>
      <PromotionManagement />
    </div>
  )
}
