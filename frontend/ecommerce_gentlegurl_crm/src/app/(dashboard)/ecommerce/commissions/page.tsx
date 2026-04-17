export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import StaffCommissionsTable from '@/components/commissions/StaffCommissionsTable'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.reports.sales.view' || perm === 'booking.commissions.override',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Ecommerce</span>
        <span className="mx-1">/</span>
        <Link href="/ecommerce/commissions" className="text-blue-600 hover:underline">
          Staff Commissions
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Ecommerce Staff Commissions</h2>
      <StaffCommissionsTable type="ECOMMERCE" routeBasePath="/ecommerce/commissions" countLabel="Sales Count" />
    </div>
  )
}
