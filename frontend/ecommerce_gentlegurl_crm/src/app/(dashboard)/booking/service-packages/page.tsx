export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ServicePackagesPage from '@/components/booking/ServicePackagesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  if (!user.permissions.includes('service-packages.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Booking</span>
        <span className="mx-1">/</span>
        <Link href="/booking/service-packages" className="text-blue-600 hover:underline">Service Packages</Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">Service Packages</h2>
      <ServicePackagesPage />
    </div>
  )
}
