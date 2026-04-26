import Link from 'next/link'
import { redirect } from 'next/navigation'

import WishlistReportPage from '@/components/reports/WishlistReportPage'
import { getCurrentUser } from '@/lib/auth'

type WishlistReportRouteProps = {
  searchParams?: Promise<{
    date_from?: string
    date_to?: string
    search?: string
  }>
}

export default async function WishlistReportRoute({ searchParams }: WishlistReportRouteProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.reports.sales.view' || perm === 'ecommerce.daily-sales-reports.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/wishlist" className="text-blue-600 hover:underline">
          Wishlist Report
        </Link>
      </div>

      <h2 className="text-3xl font-semibold mb-6">Wishlist Report</h2>

      <WishlistReportPage
        initialDateFrom={resolvedSearchParams.date_from ?? ''}
        initialDateTo={resolvedSearchParams.date_to ?? ''}
        initialSearch={resolvedSearchParams.search ?? ''}
      />
    </div>
  )
}
