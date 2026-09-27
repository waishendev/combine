import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import PrintDevicesPage from '@/components/PrintDevicesPage'
export const dynamic='force-dynamic'
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/login');if(!user.permissions.includes('print.devices.view'))redirect('/dashboard');return <div className="crm-page-shell px-10 py-6"><div className="mb-6"><p className="text-xs text-slate-500">Settings / Printers &amp; Devices</p><h1 className="text-3xl font-semibold">Printers &amp; Devices</h1><p className="mt-2 text-sm text-slate-500">Manage Android Print Agents and durable test-print delivery. Physical Bluetooth and network printer setup arrives in Phase 2.</p></div><PrintDevicesPage permissions={user.permissions}/></div>}
