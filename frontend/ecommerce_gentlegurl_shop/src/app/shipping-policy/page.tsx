export default function ShippingPolicyPage() {
  return (
    <main className="bg-gradient-to-b from-transparent via-[var(--card)]/60 to-transparent pb-16">
      <div className="mx-auto max-w-4xl space-y-10 px-4 pt-10 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
            Customer Care
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)] sm:text-4xl">
            Shipping Policy
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">
            This page explains how orders are processed, prepared, and shipped after payment is completed.
          </p>
        </header>

        <section className="grid gap-6">
          {/* Order Progress Overview */}
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Order Progress Overview
            </h2>

            <ul className="mt-4 space-y-4 text-sm text-[color:var(--text-muted)] sm:text-base">
              <li>
                <strong className="block text-[var(--foreground)]">Awaiting Payment</strong>
                <span className="block text-sm opacity-80">
                  Payment has not been received yet.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Waiting for Verification</strong>
                <span className="block text-sm opacity-80">
                  Payment proof submitted and pending review (Manual Transfer only).
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Payment Proof Rejected</strong>
                <span className="block text-sm opacity-80">
                  Submitted payment proof was not approved.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Payment Failed</strong>
                <span className="block text-sm opacity-80">
                  Online Banking payment was unsuccessful.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Cancelled</strong>
                <span className="block text-sm opacity-80">
                  Order was cancelled and will not be processed further.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Payment Confirmed</strong>
                <span className="block text-sm opacity-80">
                  Payment has been successfully verified.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Preparing</strong>
                <span className="block text-sm opacity-80">
                  Order is being prepared for shipment or pickup.
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Ready for Pickup</strong>
                <span className="block text-sm opacity-80">
                  Order is ready to be collected (Self Pickup orders only).
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Shipped</strong>
                <span className="block text-sm opacity-80">
                  Order has been handed to the courier (Delivery orders only).
                </span>
              </li>

              <li>
                <strong className="block text-[var(--foreground)]">Completed</strong>
                <span className="block text-sm opacity-80">
                  Order process has been fully completed.
                </span>
              </li>
            </ul>
          </article>

          {/* Tracking */}
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Shipping & Tracking Information
            </h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Tracking details are provided once the order status is marked as <strong>Shipped</strong>.
              We do not provide real-time parcel location tracking.
            </p>

            <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)] sm:text-base">
              <li>• Tracking Number</li>
              <li>• Courier / Shipping Company Name</li>
            </ul>

            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Customers may track delivery progress directly via the courier’s official tracking platform.
            </p>
          </article>

          {/* Address */}
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Address Accuracy
            </h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              Please ensure your shipping address and contact details are accurate and complete.
              Incorrect information may cause delivery delays or failed delivery attempts.
            </p>
          </article>

          {/* Help */}
          <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/80 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Need Help?
            </h2>
            <p className="mt-3 text-sm text-[color:var(--text-muted)] sm:text-base">
              If you have questions regarding your order or shipment, please contact us via
              <strong> WhatsApp </strong> using the floating button at the bottom-right corner of the website.
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)] sm:text-base">
              Kindly provide your <strong>order reference number</strong> for faster assistance.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
