export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminTable from '@/components/AdminTable'
import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function AdminPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.includes('users.view')

  if (!hasPermission) {
    redirect('/dashboard')
  }

  // Default to EN for now, can be extended later for multi-language support
  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">{t('sidebar.admin.management')}</span>
        <span className="mx-1">/</span>
        <Link
          href="/admin"
          className="text-blue-600 hover:underline"
        >
          {t('sidebar.admins')}
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">
        {t('sidebar.admins')}
      </h2>
      <AdminTable
        permissions={user.permissions}
        currentAdminId={user.id}
      />
    </div>
  )
}
