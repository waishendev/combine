import Link from 'next/link'
import { redirect } from 'next/navigation'

import ProductProfitReportPage from '@/components/reports/ProductProfitReportPage'
import { getCurrentUser } from '@/lib/auth'

type ProductProfitReportRouteProps = {
  searchParams?: Promise<{
    date_from?: string
    date_to?: string
    search?: string
  }>
}

export default async function ProductProfitReportRoute({ searchParams }: ProductProfitReportRouteProps) {
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
    <div className="crm-page-shell px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/product-profit" className="text-blue-600 hover:underline">
          Product Profit Report
        </Link>
      </div>

      <h2 className="mb-2 text-3xl font-semibold">Product Profit Report</h2>
      <p className="mb-6 text-sm text-slate-600">
        Review gross sales, cost snapshots, gross profit, and margin by product and variant.
      </p>

      <ProductProfitReportPage
        initialDateFrom={resolvedSearchParams.date_from ?? ''}
        initialDateTo={resolvedSearchParams.date_to ?? ''}
        initialSearch={resolvedSearchParams.search ?? ''}
      />
    </div>
  )
}
