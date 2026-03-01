type Props = {
  params: Promise<{ id: string }>
}

export default async function BookingAppointmentDetailPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Appointment Detail</h1>
        <p className="mt-1 text-sm text-slate-500">Booking ID: {id}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Coming soon: appointment timeline, status updates, and activity history.</p>
      </section>
    </div>
  )
}
