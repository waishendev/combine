import Link from 'next/link'
import { redirect } from 'next/navigation'

import MyPosSummaryPage from '@/components/MyPosSummaryPage'
import { getCurrentUser } from '@/lib/auth'

export default async function MyPosSummaryReport() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'reports.my-pos-summary.view',
  )
  const canExport = user.permissions.some(
    (perm) => perm === 'reports.my-pos-summary.export',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/my-pos-summary" className="text-blue-600 hover:underline">
          My POS Summary
        </Link>
      </div>
      <h2 className="text-3xl font-semibold mb-6">My POS Summary</h2>
      <MyPosSummaryPage />
    </div>
  )
}
