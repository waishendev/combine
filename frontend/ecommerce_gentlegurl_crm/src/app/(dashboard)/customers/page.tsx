export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import CustomerTable from '@/components/CustomerTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function CustomersPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has permission to view customers
  const hasPermission = user.permissions.some(
    (perm) => perm === 'customers.view'
  )
  
  if (!hasPermission) {
    redirect('/dashboard')
  }

  // Default to EN for now, can be extended later for multi-language support
  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Customers & Loyalty</span>
        <span className="mx-1">/</span>
        <Link
          href="/customers"
          className="text-blue-600 hover:underline"
        >
          Customers
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Customers
      </h2>
      <CustomerTable
        permissions={user.permissions}
      />
    </div>
  )
}

