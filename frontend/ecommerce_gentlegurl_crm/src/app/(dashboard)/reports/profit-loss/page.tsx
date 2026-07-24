import { redirect } from 'next/navigation'

import ProfitLossReportPage from '@/components/reports/ProfitLossReportPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.permissions.includes('ecommerce.reports.profit-loss.view')) redirect('/dashboard')

  return <ProfitLossReportPage />
}
