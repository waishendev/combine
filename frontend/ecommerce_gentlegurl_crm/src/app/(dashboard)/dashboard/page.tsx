export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { getTranslator } from '@/lib/i18n-server'
import type { LangCode } from '@/lib/i18n'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const lang: LangCode = 'EN'
  const t = await getTranslator(lang)
  const displayName = user.staff_name?.trim() || user.name?.trim() || user.username

  return (
    <div className="crm-page-shell py-6 px-4 sm:px-6 lg:px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Home</span>
        <span className="mx-1">/</span>
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          {t('sidebar.dashboard')}
        </Link>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12 sm:py-20">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <i className="fa-solid fa-hand-sparkles text-2xl" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t('dashboard.welcomeTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            {t('dashboard.welcomeGreeting').replace('{name}', displayName)}
          </p>
          <p className="mt-2 text-sm text-slate-500">{t('dashboard.welcomeHint')}</p>
        </div>
      </div>
    </div>
  )
}
