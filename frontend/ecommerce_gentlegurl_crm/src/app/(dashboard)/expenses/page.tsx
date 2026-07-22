export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import ExpenseManagement from '@/components/ExpenseManagement'
export default async function ExpensesPage(){const user=await getCurrentUser();if(!user)redirect('/login');if(!user.permissions.includes('expenses.view'))redirect('/dashboard');return <ExpenseManagement permissions={user.permissions}/>}
