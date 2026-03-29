import Link from 'next/link'
import { redirect } from 'next/navigation'

import SalesChannelReportPage from '@/components/SalesChannelReportPage'
import { getCurrentUser } from '@/lib/auth'

export default async function DailyBookingSalesPage() {
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
        <Link href="/reports/sales/daily/booking" className="text-blue-600 hover:underline">
          Daily
        </Link>
        <span className="mx-1">/</span>
        <Link href="/reports/sales/daily/booking" className="text-blue-600 hover:underline">
          Booking sales
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Booking sales</h2>
      <SalesChannelReportPage mode="booking" canExport={canExport} defaultDatePreset="today" />
    </div>
  )
}
