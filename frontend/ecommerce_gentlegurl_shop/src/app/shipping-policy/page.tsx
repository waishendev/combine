export default function ShippingPolicyPage() {
  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-4xl space-y-10 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
            Customer Care
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">Gentlegurls Shipping Policy</h1>
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">
            This page explains how we process shipments after you choose a shipping method. We will confirm the shipment
            in the后台 (back-end), then update your order with the tracking details so you can follow the delivery easily.
          </p>
        </header>

        <section className="grid gap-6">
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Shipping Confirmation Flow</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              After you select SHIPPING at checkout, our team verifies the order and marks the shipment as completed in
              the system. Once confirmed, we prepare the parcel for courier pickup.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Tracking Details We Provide</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Once the parcel is handed to the courier, we will update your order with:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)] sm:text-base">
              <li className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
                <span>Tracking number (Tracking No.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
                <span>Courier / shipping company name</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent-strong)]" />
                <span>Shipment status updates (when available)</span>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Where to Check Your Tracking</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              You can view tracking details in your account under <strong>Orders</strong>. We also provide an{' '}
              <strong>Order Tracking</strong> page where you can quickly check the latest shipping progress.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Estimated Delivery Window</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Delivery times vary based on location and courier schedules. If you need a more precise estimate, check the
              tracking updates or contact us with your order reference.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Address Accuracy</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Please ensure your shipping address is complete and correct. Incorrect details may cause delays or failed
              delivery attempts.
            </p>
          </article>

          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Need Help?</h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              If you cannot find your tracking information or have questions, please reach out to us via Instagram with
              your order reference. We will assist as soon as possible.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
