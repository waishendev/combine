export default function BookingBlocksPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Booking Blocks</h1>
        <p className="mt-1 text-sm text-slate-500">Manage store-wide and staff-level blocked times/timeoffs.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" disabled>
            <option value="">Scope (Store / Staff)</option>
          </select>
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Start datetime" readOnly />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="End datetime" readOnly />
          <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled>
            Add Block
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Coming soon: blocks/timeoffs list and management.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
