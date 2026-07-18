export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import AppointmentActivityLogTable from '@/components/appointments/AppointmentActivityLogTable'
import { getCurrentUser } from '@/lib/auth'

export default async function AppointmentActivityLogsPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')
  if (!user.permissions.includes('appointment_activity_logs.view')) redirect('/dashboard')

  return (
    <div className="crm-page-shell py-6 px-10">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-200">
          <i className="fa-solid fa-calendar-check text-white text-lg" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Appointment Activity Logs</h2>
          <p className="text-sm text-slate-500">See which booking was affected, what happened, who performed it, and when.</p>
        </div>
      </div>
      <AppointmentActivityLogTable />
    </div>
  )
}
