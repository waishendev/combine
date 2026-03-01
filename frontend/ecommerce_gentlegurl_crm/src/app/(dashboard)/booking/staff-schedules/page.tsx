export default function BookingStaffSchedulesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Staff Schedules</h1>
        <p className="mt-1 text-sm text-slate-500">Maintain weekly staff working hours and break periods.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" disabled>
            <option value="">Select staff</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" disabled>
            <option value="">Select day</option>
          </select>
          <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled>
            Add Schedule
          </button>
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Coming soon: weekly schedule matrix and CRUD actions.
        </div>
      </section>
    </div>
  )
}
