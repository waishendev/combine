export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import BankAccountTable from '@/components/BankAccountTable'
import { getCurrentUser } from '@/lib/auth'

export default async function BankAccountsPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has permission to view bank accounts
  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.bank-accounts.view'
  )
  
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Payment Gateway</span>
        <span className="mx-1">/</span>
        <Link
          href="/bank-accounts"
          className="text-blue-600 hover:underline"
        >
          Bank Accounts
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Bank Accounts
      </h2>
      <BankAccountTable
        permissions={user.permissions}
      />
    </div>
  )
}

