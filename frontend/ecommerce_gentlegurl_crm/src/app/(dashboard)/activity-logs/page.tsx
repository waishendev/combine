export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ActivityLogTable from '@/components/ActivityLogTable'
import { getCurrentUser } from '@/lib/auth'

export default async function ActivityLogsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'activity-logs.view'
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">System</span>
        <span className="mx-1">/</span>
        <Link
          href="/activity-logs"
          className="text-blue-600 hover:underline"
        >
          Activity Logs
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200">
          <i className="fa-solid fa-clock-rotate-left text-white text-lg" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activity Logs</h2>
          <p className="text-sm text-slate-500">Track all changes made by your team across the system</p>
        </div>
      </div>

      <ActivityLogTable />
    </div>
  )
}
