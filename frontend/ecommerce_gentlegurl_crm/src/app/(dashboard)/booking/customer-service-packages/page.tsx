export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerServicePackagesPage from '@/components/booking/CustomerServicePackagesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  if (!user.permissions.includes('customer-service-packages.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/customer-service-packages" className="text-blue-600 hover:underline">Customer Packages</Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">Customer Service Packages</h2>
      <CustomerServicePackagesPage />
    </div>
  )
}
