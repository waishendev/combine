export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import VoucherAssignLogsPage from '@/components/VoucherAssignLogsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function VoucherAssignLogs() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.vouchers.assign.logs.view'
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Marketing</span>
        <span className="mx-1">/</span>
        <Link href="/vouchers/assign-logs" className="text-blue-600 hover:underline">
          Voucher Assign Logs
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Voucher Assign Logs</h2>
      <VoucherAssignLogsPage />
    </div>
  )
}
