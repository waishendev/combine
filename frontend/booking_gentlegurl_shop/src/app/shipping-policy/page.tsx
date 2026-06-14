export default function ShippingPolicyPage() {
  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-4xl space-y-10 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
            Customer Care
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
            Booking &amp; Service Policy
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">
            This page explains how appointments are confirmed, prepared, and completed after payment.
          </p>
        </header>

        <section className="grid gap-6">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Booking Progress Overview</h2>
            <ul className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)] sm:text-base">
              <li>
                <strong className="block text-[var(--foreground)]">Awaiting Payment</strong>
                <span className="block text-sm opacity-80">Payment has not been received yet.</span>
              </li>
              <li>
                <strong className="block text-[var(--foreground)]">Waiting for Verification</strong>
                <span className="block text-sm opacity-80">
                  Payment proof submitted and pending review (manual transfer only).
                </span>
              </li>
              <li>
                <strong className="block text-[var(--foreground)]">Payment Confirmed</strong>
                <span className="block text-sm opacity-80">Payment has been successfully verified.</span>
              </li>
              <li>
                <strong className="block text-[var(--foreground)]">Confirmed</strong>
                <span className="block text-sm opacity-80">Your appointment slot has been reserved.</span>
              </li>
              <li>
                <strong className="block text-[var(--foreground)]">Completed</strong>
                <span className="block text-sm opacity-80">Your service has been completed.</span>
              </li>
              <li>
                <strong className="block text-[var(--foreground)]">Cancelled</strong>
                <span className="block text-sm opacity-80">
                  The booking was cancelled and will not proceed further.
                </span>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Arrival &amp; Punctuality</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Please arrive on time for your appointment. Late arrivals may reduce your service duration or require
              rescheduling, depending on the next available slot.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Service Packages &amp; Add-ons</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Selected services, add-ons, and package redemptions are confirmed at booking. Any changes on the day of
              service are subject to staff availability and may affect pricing or timing.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Need Help?</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              If you have questions regarding your booking or appointment status, please contact us via{" "}
              <strong>WhatsApp</strong> using the floating button at the bottom-right corner of the website.
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)] sm:text-base">
              Kindly provide your <strong>booking reference number</strong> for faster assistance.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
