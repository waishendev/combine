import { redirect } from 'next/navigation'
import PosPaymentMethodSettings from '@/components/pos/PosPaymentMethodSettings'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: 'POS Payment Methods' }

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.permissions.includes('pos.payment-method-settings.view')) redirect('/dashboard')
  return <div className="crm-page-shell p-4 md:p-6"><PosPaymentMethodSettings /></div>
}
