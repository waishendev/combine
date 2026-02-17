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
    <div className="overflow-y-auto px-10 py-6">
      <PosPageContent />
    </div>
  )
}
