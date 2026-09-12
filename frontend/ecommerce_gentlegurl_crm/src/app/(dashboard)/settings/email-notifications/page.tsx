export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import BranchNotificationSettingsForm from '@/components/BranchNotificationSettingsForm'
import { getCurrentUser } from '@/lib/auth'
export default async function EmailNotificationSettingsPage() {
 const user=await getCurrentUser(); if(!user) redirect('/login')
 const canView=user.permissions.includes('ecommerce.settings.view')||user.permissions.includes('booking.settings.view')
 const canEdit=user.permissions.includes('ecommerce.settings.update')||user.permissions.includes('booking.settings.update')
 if(!canView&&!canEdit) redirect('/dashboard')
 return <div className="crm-page-shell px-10 py-6"><h1 className="text-3xl font-semibold text-slate-900">Email / Notifications</h1><p className="mb-6 mt-2 text-sm text-slate-500">Manage operational notifications for the concrete Header Branch. Global Ecommerce payment proof and support settings remain under Shop Settings → General Settings.</p><BranchNotificationSettingsForm canEdit={canEdit}/></div>
}
