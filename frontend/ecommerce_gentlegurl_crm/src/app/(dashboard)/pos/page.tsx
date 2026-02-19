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
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1400px]">
        <PosPageContent />
      </div>
    </div>
  )
}
