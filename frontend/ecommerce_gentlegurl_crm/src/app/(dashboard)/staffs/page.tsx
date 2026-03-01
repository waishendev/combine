export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import StaffTable from '@/components/StaffTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function StaffPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('staff.view')) {
    redirect('/dashboard')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">{t('sidebar.admin.management')}</span>
        <span className="mx-1">/</span>
        <Link href="/staffs" className="text-blue-600 hover:underline">Staffs</Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">Staffs</h2>
      <StaffTable permissions={user.permissions} />
    </div>
  )
}
