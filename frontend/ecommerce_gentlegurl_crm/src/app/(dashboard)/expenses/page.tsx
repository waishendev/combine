import { redirect } from 'next/navigation'

import ExpensesPage from '@/components/expenses/ExpensesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('expenses.view')) {
    redirect('/dashboard')
  }

  return <ExpensesPage permissions={user.permissions} />
}
