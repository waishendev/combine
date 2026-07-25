export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ThermalPrinterSettingsForm from '@/components/ThermalPrinterSettingsForm'
import { getCurrentUser } from '@/lib/auth'

export default async function ThermalPrinterSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const canView = user.permissions.includes('ecommerce.thermal-printer-settings.view')
  const canUpdate = user.permissions.includes('ecommerce.thermal-printer-settings.update')
  if (!canView && !canUpdate) redirect('/dashboard')

  return <div className="crm-page-shell px-10 py-6">
    <div className="mb-4 flex items-center text-xs text-gray-500"><span>Settings</span><span className="mx-1">/</span><Link href="/settings/thermal-printer" className="text-blue-600 hover:underline">Thermal Printer</Link></div>
    <div className="mb-6"><h1 className="text-3xl font-semibold leading-tight text-slate-900">Thermal Printer Settings</h1><p className="mt-2 text-sm text-slate-500">Configure the receipt printer used by POS checkout.</p></div>
    <ThermalPrinterSettingsForm canEdit={canUpdate} />
  </div>
}
