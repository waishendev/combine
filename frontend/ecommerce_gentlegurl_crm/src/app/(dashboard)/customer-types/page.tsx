export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerTypeTable from '@/components/customer-types/CustomerTypeTable'
import { getCurrentUser } from '@/lib/auth'

export default async function CustomerTypesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.some((perm) => perm === 'customers.view')) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Customers & Loyalty</span>
        <span className="mx-1">/</span>
        <Link href="/customer-types" className="text-blue-600 hover:underline">
          Customer Types
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Customer Types</h2>
      <CustomerTypeTable permissions={user.permissions} />
    </div>
  )
}
