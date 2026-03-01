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

  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto px-10 py-6">
      <div className="mb-4 text-xs">
        <span className="text-gray-500">Reports</span>
        <span className="mx-1">/</span>
        <Link href="/reports/my-pos-summary" className="text-blue-600 hover:underline">
          My POS Summary
        </Link>
      </div>
      <h2 className="mb-6 text-3xl font-semibold">My POS Summary</h2>
      <MyPosSummaryPage />
    </div>
  )
}
