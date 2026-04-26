export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerHistoryPage from '@/components/customers/CustomerHistoryPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('customers.view')) {
    redirect('/dashboard')
  }

  const { id } = await params

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Customers & Loyalty</span>
        <span className="mx-1">/</span>
        <Link href="/customers" className="text-blue-600 hover:underline">
          Customers
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Customer History</span>
      </div>

      <h2 className="mb-6 text-3xl font-semibold">Customer History</h2>

      <CustomerHistoryPage customerId={id} />
    </div>
  )
}
