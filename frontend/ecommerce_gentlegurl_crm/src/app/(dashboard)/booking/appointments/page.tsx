export default function BookingAppointmentsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Booking Appointments</h1>
        <p className="mt-1 text-sm text-slate-500">Manage booking appointments, statuses, and schedule changes.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search booking code / customer" readOnly />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" disabled>
            <option value="">All statuses</option>
          </select>
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Date from" readOnly />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Date to" readOnly />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Booking Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Coming soon: appointment list integration.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
