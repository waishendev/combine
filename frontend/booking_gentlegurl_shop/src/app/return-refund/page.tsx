export default function ReturnRefundPage() {
  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-4xl space-y-10 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
            Customer Care
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
            Cancellation &amp; Refund Policy
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">
            Gentlegurls aims to deliver a smooth and enjoyable salon experience. The policy below outlines how we
            handle booking cancellations, rescheduling, and refunds.
          </p>
        </header>

        <section className="grid gap-6">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Rescheduling</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              You may reschedule your appointment through your account, subject to availability and the rescheduling
              window shown at checkout. Late rescheduling requests may not be accepted if they fall within the cutoff
              period before your appointment.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Cancellation</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Cancellations must be made within the allowed timeframe before your appointment. Deposits or prepaid
              amounts may be non-refundable if cancellation occurs after the cutoff period, depending on the service
              booked.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Refund Eligibility</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Refunds are considered for eligible cancellations, duplicate payments, or verified service issues reviewed
              by our team. Approved refunds will be processed back to the original payment method within 3 to 7 working
              days.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">No-Show Policy</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              If you miss your appointment without prior notice, your booking may be marked as a no-show and any deposit
              or prepaid amount may be forfeited.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Need Help?</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              If you have questions about cancelling or rescheduling a booking, please contact us via{" "}
              <strong>WhatsApp</strong> using the floating button at the bottom-right corner of the website. Kindly
              provide your <strong>booking reference number</strong> for faster assistance.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
