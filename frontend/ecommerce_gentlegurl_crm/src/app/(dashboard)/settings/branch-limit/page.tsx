import Link from 'next/link'
import { redirect } from 'next/navigation'

import BranchLimitSettings from '@/components/BranchLimitSettings'
import { getCurrentUser } from '@/lib/auth'

export default async function BranchLimitPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const roleNames = user.roles.map((role) => typeof role === 'string' ? role : role.name)
  if (!roleNames.includes('infra_core_x1')) redirect('/dashboard')

  return (
    <div className="crm-page-shell px-10 py-6">
      <div className="mb-4 flex items-center text-xs text-gray-500">
        <span>Settings</span><span className="mx-1">/</span>
        <Link href="/settings/branch-limit" className="text-blue-600 hover:underline">Branch Limit</Link>
      </div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold leading-tight text-slate-900">Branch Limit Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Set the maximum number of branches that can be created on the platform.</p>
      </div>
      <BranchLimitSettings />
    </div>
  )
}
