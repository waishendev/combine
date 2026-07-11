export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import StaffMySalesDashboard from '@/components/reports/StaffMySalesDashboard'
import { getCurrentUser } from '@/lib/auth'

export default async function StaffMySalesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.staff_id) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell py-6 px-4 sm:px-6 lg:px-10">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Dashboard</span>
        <span className="mx-1">/</span>
        <Link href="/my-sales" className="text-blue-600 hover:underline">
          My Sales
        </Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">My Sales</h2>
      <StaffMySalesDashboard />
    </div>
  )
}
