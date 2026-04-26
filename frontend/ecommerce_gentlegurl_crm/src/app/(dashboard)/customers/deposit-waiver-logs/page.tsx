export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerDepositWaiverLogsPage from '@/components/CustomerDepositWaiverLogsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function DepositWaiverLogsRoutePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'customers.deposit_waiver_logs.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Customers & Loyalty</span>
        <span className="mx-1">/</span>
        <Link href="/customers/deposit-waiver-logs" className="text-blue-600 hover:underline">
          Deposit Waiver Logs
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Deposit Waiver Logs</h2>
      <CustomerDepositWaiverLogsPage />
    </div>
  )
}
