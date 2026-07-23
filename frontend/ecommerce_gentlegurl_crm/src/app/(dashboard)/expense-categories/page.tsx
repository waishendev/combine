import { redirect } from 'next/navigation'

import ExpenseCategoriesPage from '@/components/expenses/ExpenseCategoriesPage'
import { getCurrentUser } from '@/lib/auth'

export default async function Page() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!user.permissions.includes('expense_categories.view')) {
    redirect('/dashboard')
  }

  return <ExpenseCategoriesPage permissions={user.permissions} />
}
