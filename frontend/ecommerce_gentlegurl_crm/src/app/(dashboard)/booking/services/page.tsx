export default function BookingServicesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Booking Services</h1>
        <p className="mt-1 text-sm text-slate-500">Configure available booking services, durations, and deposits.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search service" readOnly />
          <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled>
            Create Service
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Buffer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Coming soon: services management table.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
