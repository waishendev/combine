export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PosPageContent from '@/components/PosPageContent'
import { getCurrentUser } from '@/lib/auth'

export default async function PosPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('ecommerce.orders.create')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-10 lg:py-6">
      <PosPageContent />
    </div>
  )
}
