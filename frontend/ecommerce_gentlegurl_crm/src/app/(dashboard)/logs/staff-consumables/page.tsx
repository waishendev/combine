export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import StaffConsumableLogsPageContent, { type StaffConsumableLogInitialFilters } from '@/components/StaffConsumableLogsPageContent'
import { getCurrentUser } from '@/lib/auth'

type StaffConsumableLogsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? ''

export default async function StaffConsumableLogsPage({ searchParams }: StaffConsumableLogsPageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('pos.staff_consumables.view_logs')) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const initialFilters: StaffConsumableLogInitialFilters = {
    staffId: firstParam(resolvedSearchParams.staff_id),
    dateFrom: firstParam(resolvedSearchParams.from_date),
    dateTo: firstParam(resolvedSearchParams.to_date),
    search: firstParam(resolvedSearchParams.search),
  }

  return <StaffConsumableLogsPageContent initialFilters={initialFilters} />
}
