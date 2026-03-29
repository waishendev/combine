import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerSalesDomainReportPage from '@/components/CustomerSalesDomainReportPage'
import { getCurrentUser } from '@/lib/auth'

export default async function DailyBookingCustomerSalesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some((perm) => perm === 'ecommerce.reports.sales.view')
  const canExport = user.permissions.some((perm) => perm === 'ecommerce.reports.sales.export')

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/sales/daily/customers-booking" className="text-blue-600 hover:underline">
          Daily
        </Link>
        <span className="mx-1">/</span>
        <Link href="/reports/sales/daily/customers-booking" className="text-blue-600 hover:underline">
          Booking customer sales
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Booking customer sales</h2>
      <CustomerSalesDomainReportPage mode="booking" canExport={canExport} defaultDatePreset="today" />
    </div>
  )
}
