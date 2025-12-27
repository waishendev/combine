export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ReturnOrdersTable from '@/components/ReturnOrdersTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function ReturnsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.returns.view'
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Return Management</span>
        <span className="mx-1">/</span>
        <Link
          href="/returns"
          className="text-blue-600 hover:underline"
        >
          Return Orders
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        Return Orders
      </h2>
      <ReturnOrdersTable />
    </div>
  )
}
